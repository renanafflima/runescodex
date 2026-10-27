import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { CatalogEmpty, CatalogLoading } from "../components/catalog/CatalogState";
import { Section } from "../components/layout/Section";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/FormControls";
import { Modal } from "../components/ui/Modal";
import { confirmCurrentDevice, listAccountDevices, removeAccountDevice, type AccountDevice, type AccountDeviceList } from "../services/api/devices";
import { describeApiError } from "../services/api/errors";

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não identificado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function shown(value: string | null) {
  return value || "Não identificado";
}

export function AccountDevices() {
  const { logout } = useAuth();
  const [data, setData] = useState<AccountDeviceList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<AccountDevice | null>(null);
  const [password, setPassword] = useState("");
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await listAccountDevices());
    } catch (caught) {
      setError(describeApiError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmRemove() {
    if (!pending || !data) return;
    setRemoving(true);
    setNotice("");
    try {
      const proof = data.hasPassword ? { password } : await confirmCurrentDevice();
      const result = await removeAccountDevice(pending.id, proof);
      setPending(null);
      setPassword("");
      if (result.current) {
        await logout();
        return;
      }
      setNotice("Equipamento removido. A vaga está disponível.");
      await load();
    } catch (caught) {
      setError(describeApiError(caught));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Section
      className="device-section"
      description="O limite é de dois equipamentos autorizados. Entrar de novo neste navegador não ocupa outra vaga."
      eyebrow="Conta"
      title="Meus equipamentos"
    >
      {loading ? <CatalogLoading label="Carregando equipamentos" /> : null}
      {!loading && error ? (
        <div className="device-card" role="alert">
          <p>{error}</p>
          <Button onClick={() => void load()} type="button" variant="secondary">Tentar novamente</Button>
        </div>
      ) : null}
      {!loading && !error && data ? (
        <>
          <p className="device-count">Equipamentos vinculados: {data.active} de {data.limit}</p>
          {notice ? <p role="status">{notice}</p> : null}
          {data.items.length === 0 ? (
            <CatalogEmpty
              description="Nenhum equipamento está vinculado a esta sessão. Entre novamente para cadastrar este navegador."
              title="Nenhum equipamento"
            />
          ) : (
            <div className="device-grid">
              {data.items.map((device) => (
                <article className="device-card" key={device.id}>
                  <header>
                    <strong>{device.label}</strong>
                    {device.current ? <Badge tone="gold">Este equipamento</Badge> : null}
                  </header>
                  <p>{shown(device.osName)} · {shown(device.clientName)}</p>
                  <p>Cadastrado em {when(device.createdAt)}</p>
                  <p>Última atividade: {when(device.lastSeenAt)}</p>
                  <p>Status: {device.status === "ACTIVE" ? "Ativo" : device.status}</p>
                  <div className="device-card__actions">
                    <Button onClick={() => { setPending(device); setPassword(""); setError(""); }} size="sm" type="button" variant="danger">
                      Remover equipamento
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}
      <Modal
        description="O equipamento deixará de estar autorizado a utilizar a conta. As sessões dele serão encerradas."
        footer={
          <>
            <Button onClick={() => setPending(null)} type="button" variant="ghost">Cancelar</Button>
            <Button loading={removing} onClick={() => void confirmRemove()} type="button" variant="danger">
              Remover equipamento
            </Button>
          </>
        }
        onClose={() => setPending(null)}
        open={Boolean(pending)}
        title="Remover equipamento"
      >
        <p>Remover {pending?.label || "este equipamento"}? Ele deixará de estar autorizado a utilizar a conta.</p>
        {data?.hasPassword ? (
          <Input
            label="Senha da conta"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        ) : (
          <p>Esta conta entra com o Google. A remoção será confirmada com a chave deste equipamento.</p>
        )}
      </Modal>
    </Section>
  );
}
