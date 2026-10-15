#!/usr/bin/env python3
"""Coleta modificadores elementais das páginas da TibiaWiki e gera SQL revisável.

Não grava no banco. Entrada: runescodex_hunt_creature_elementos_charms.csv
Saídas: creature-elements-review.csv, creature-elements-upsert.sql, creature-elements-report.txt
Execute com Python 3.10+: python scripts/coletar_elementos_tibiawiki.py [caminho_csv]
"""
import csv, hashlib, html, re, sys, time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from html.parser import HTMLParser

ELEMENT_MAP = {
    'Físico': 'PHYSICAL', 'Fisico': 'PHYSICAL',
    'Fogo': 'FIRE', 'Gelo': 'ICE', 'Terra': 'EARTH',
    'Energia': 'ENERGY', 'Sagrado': 'HOLY', 'Morte': 'DEATH',
}
PATTERN = re.compile(r'(\d{1,3})\s*%\s*(?:Neutro|Fraco|Forte|Imune)\s+a\s+(Físico|Fisico|Fogo|Gelo|Terra|Energia|Sagrado|Morte)', re.I)

# Essas criaturas foram explicitamente descartadas pelo projeto.
IGNORED_NAME_PATTERNS = (re.compile(r'^Butterfly\s*\(', re.I),)

def is_ignored(name):
    return any(pattern.search(name.strip()) for pattern in IGNORED_NAME_PATTERNS)

class TextExtractor(HTMLParser):
    def __init__(self): super().__init__(); self.parts=[]; self.skip=0
    def handle_starttag(self, tag, attrs):
        if tag in ('script','style','noscript'): self.skip += 1
    def handle_endtag(self, tag):
        if tag in ('script','style','noscript') and self.skip: self.skip -= 1
    def handle_data(self, data):
        if not self.skip: self.parts.append(data)

def fetch(url):
    req = Request(url, headers={'User-Agent':'RuneCodex elemental data collector/1.0 (research; contact via project owner)', 'Accept-Language':'pt-BR,pt;q=0.9'})
    with urlopen(req, timeout=25) as response:
        return response.read().decode('utf-8', errors='replace')

def q(s): return "'" + str(s).replace("'", "''") + "'"

def main():
    default = Path(__file__).resolve().parent / 'runescodex_hunt_creature_elementos_charms.csv'
    src = Path(sys.argv[1]).resolve() if len(sys.argv)>1 else default
    if not src.exists():
        raise SystemExit(f'CSV não encontrado: {src}\nPasse o caminho do CSV como argumento.')
    with src.open(encoding='utf-8-sig', newline='') as f:
        rows=list(csv.DictReader(f))
    creatures={}
    ignored=[]
    for row in rows:
        cid=(row.get('creature_id') or '').strip(); name=(row.get('creature_name') or '').strip(); url=(row.get('creature_wiki_url') or '').strip()
        if is_ignored(name):
            ignored.append(name)
            continue
        if cid and name and url: creatures.setdefault(cid, {'id':cid,'name':name,'url':url})
    found=[]; unresolved=[]; failures=[]
    out=src.parent
    review=out/'creature-elements-review.csv'
    pending=out/'creature-elements-pending.csv'
    def save_csvs():
        with review.open('w',encoding='utf-8-sig',newline='') as f:
            fields=['creature_id','creature_name','creature_wiki_url','element','modifier']
            w=csv.DictWriter(f,fieldnames=fields); w.writeheader()
            w.writerows([{'creature_id':r['id'],'creature_name':r['name'],'creature_wiki_url':r['url'],'element':r['element'],'modifier':r['modifier']} for r in found])
        with pending.open('w',encoding='utf-8-sig',newline='') as f:
            fields=['creature_id','creature_name','creature_wiki_url','reason']
            w=csv.DictWriter(f,fieldnames=fields); w.writeheader()
            w.writerows([{'creature_id':r['id'],'creature_name':r['name'],'creature_wiki_url':r['url'],'reason':r['reason']} for r in unresolved+failures])
    for i, c in enumerate(creatures.values(),1):
        try:
            raw=fetch(c['url'])
            parser=TextExtractor(); parser.feed(raw)
            text=' '.join(html.unescape(x) for x in parser.parts)
            # Only accept explicit modifier-label pairs from the creature page.
            mods={}
            for pct, label in PATTERN.findall(text):
                element=ELEMENT_MAP.get(label[0].upper()+label[1:] if label else label)
                if element: mods[element]=int(pct)
            if not mods:
                # Sem dados extraídos: registrar pendência, mas não impedir o SQL das demais criaturas.
                unresolved.append({**c,'reason':'Nenhum modificador reconhecido na página'})
            else:
                # Grava somente os elementos explicitamente encontrados; ausência não significa 100%.
                for element, modifier in sorted(mods.items()):
                    found.append({**c,'element':element,'modifier':modifier})
        except (HTTPError, URLError, TimeoutError, Exception) as e:
            failures.append({**c,'reason':f'{type(e).__name__}: {e}'})
        if i % 20 == 0:
            save_csvs()  # Salva checkpoint para não perder a coleta se houver erro posterior.
            print(f'Consultadas {i}/{len(creatures)} criaturas; modificadores encontrados: {len(found)}')
        time.sleep(0.15)
    save_csvs()
    sql=out/'creature-elements-upsert.sql'
    with sql.open('w',encoding='utf-8') as f:
        f.write('-- Gerado a partir das páginas individuais da TibiaWiki. Revisar antes de executar.\n')
        f.write('-- Modificadores expressos em percentagem: 100 neutro, >100 fraco, <100 resistente, 0 imune.\n')
        f.write('-- Não inclui criaturas/elementos sem valor extraído; não inventa 100%.\n')
        f.write('BEGIN;\n')
        f.write('INSERT INTO public."CreatureElement" ("id", "creatureId", "element", "modifier", "createdAt", "updatedAt")\nVALUES\n')
        vals=[]
        for r in found:
            # Deterministic IDs avoid duplicate insert rows when rerunning this generated SQL.
            key=f"{r['id']}|{r['element']}"
            eid='wiki-'+hashlib.sha256(key.encode()).hexdigest()[:32]
            vals.append(f"  ({q(eid)}, {q(r['id'])}, {q(r['element'])}::\"ElementType\", {r['modifier']}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
        if vals:
            f.write(',\n'.join(vals)+'\n')
            f.write('ON CONFLICT ("creatureId", "element") DO UPDATE SET "modifier" = EXCLUDED."modifier", "updatedAt" = CURRENT_TIMESTAMP;\n')
        else: f.write('-- Nenhum modificador extraído; nada a importar.\n')
        f.write('COMMIT;\n')
    report=out/'creature-elements-report.txt'
    report.write_text(f"Criaturas únicas processadas: {len(creatures)}\nCriaturas ignoradas (borboletas): {len(set(ignored))}\nLinhas elemento/modificador extraídas: {len(found)}\nCriaturas sem modificador reconhecido: {len(unresolved)}\nFalhas HTTP/parse: {len(failures)}\n\nArquivos gerados:\n- {review.name}\n- {pending.name}\n- {sql.name}\n\nO SQL contém somente modificadores extraídos explicitamente. Dados ausentes não viram 100% e não bloqueiam os demais registros.\nNão houve conexão nem gravação no banco.\n",encoding='utf-8')
    print(report.read_text())
if __name__=='__main__': main()
