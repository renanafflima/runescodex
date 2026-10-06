import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { PageContainer } from "../components/layout/PageContainer";
import { Section } from "../components/layout/Section";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, StatCard } from "../components/ui/Card";
import { Input, Select } from "../components/ui/FormControls";
import { Icon } from "../components/ui/Icon";
import { Modal } from "../components/ui/Modal";
import { Toast } from "../components/ui/Toast";
import { CatalogEmpty, CatalogLoading } from "../components/catalog/CatalogState";
import { initialsFrom } from "../domain/format";
import { VOCATIONS } from "../domain/vocation";
import { describeApiError } from "../services/api/errors";
import type { Character } from "../services/api/types";
import type { CharacterPayload } from "../services/api/characters";

const emptyForm: CharacterPayload = {
  name: "",
  vocation: "EK",
  level: 8,
  world: "",
};

export function ProfilePage() {
  const {
    user,
    characters,
    activeCharacter,
    logout,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    setActiveCharacter,
    reloadCharacters,
    status,
  } = useAuth();
  const [form, setForm] = useState<CharacterPayload>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Character | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    title: string;
    tone: "info" | "success" | "error";
  } | null>(null);

  if (status === "loading") {
    return (
      <div className="profile-page">
        <PageContainer className="profile-content" size="wide">
          <CatalogLoading label="Carregando perfil" />
        </PageContainer>
      </div>
    );
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(character: Character) {
    setEditingId(character.id);
    setForm({
      name: character.name,
      vocation: character.vocation,
      level: character.level,
      world: character.world,
    });
    setModalOpen(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.world.trim() || form.level < 1) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        vocation: form.vocation,
        level: Number(form.level),
        world: form.world.trim(),
      };
      if (editingId) await updateCharacter(editingId, payload);
      else await createCharacter(payload);
      setModalOpen(false);
      setNotice({
        title: editingId ? "Personagem atualizado" : "Personagem criado",
        message: "A companhia foi sincronizada com a sua conta.",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        title: "Não foi possível salvar",
        message: describeApiError(error),
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id: string) {
    try {
      await setActiveCharacter(id);
      setNotice({
        title: "Personagem ativo",
        message: "As Hunts passam a considerar esta vocação e este level.",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        title: "Não foi possível ativar",
        message: describeApiError(error),
        tone: "error",
      });
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await deleteCharacter(pendingDelete.id);
      setPendingDelete(null);
      setNotice({
        title: "Personagem removido",
        message: "A companhia foi atualizada.",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        title: "Não foi possível remover",
        message: describeApiError(error),
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-page">
      <section className="profile-hero" aria-labelledby="profile-title">
        <PageContainer className="profile-hero__inner" size="wide">
          <div className="profile-identity">
            <div className="profile-identity__avatar" aria-hidden="true">
              {initialsFrom(user?.email || "R")}
            </div>
            <div className="profile-identity__copy">
              <Badge tone="gold">Perfil RuneCodex</Badge>
              <h1 id="profile-title">{user?.email || "Sua jornada"}</h1>
              <p>
                Personagens, conta e progresso — a mesma identidade do
                aplicativo, agora no Web.
              </p>
            </div>
          </div>
          <Button onClick={() => void logout()} variant="secondary">
            Sair
          </Button>
        </PageContainer>
      </section>

      <PageContainer className="profile-content" size="wide">
        <div className="profile-stats" aria-label="Resumo do perfil">
          <StatCard
            detail="Na sua conta"
            label="Personagens"
            value={String(characters.length)}
          />
          <StatCard
            detail={activeCharacter ? `${activeCharacter.vocation} ${activeCharacter.level}` : "Nenhum escolhido"}
            label="Personagem ativo"
            value={activeCharacter?.name || "—"}
          />
          <StatCard detail="Sessão autenticada" label="Acesso" value="Conta" />
        </div>

        <div className="profile-layout">
          <Section
            actions={
              <Button onClick={openCreate} size="sm">
                Novo personagem
              </Button>
            }
            className="profile-characters"
            description="O personagem ativo define vocação e level usados nas Hunts."
            eyebrow="Sua companhia"
            title="Personagens"
          >
            {characters.length === 0 ? (
              <CatalogEmpty
                action={
                  <Button onClick={openCreate} variant="secondary">
                    Criar personagem
                  </Button>
                }
                description="Você ainda não cadastrou personagens nesta conta."
                title="Nenhum personagem"
              />
            ) : (
              <div className="character-slots">
                {characters.map((character) => {
                  const isActive = activeCharacter?.id === character.id;
                  return (
                    <article className="character-slot" key={character.id}>
                      <span className="character-slot__mark" aria-hidden="true">
                        {character.vocation.slice(0, 2)}
                      </span>
                      <div>
                        <strong>
                          {character.name}
                          {isActive ? <Badge tone="gold">Ativo</Badge> : null}
                        </strong>
                        <span>
                          {character.vocation} · {character.level} · {character.world}
                        </span>
                      </div>
                      <div className="character-slot__actions">
                        {isActive ? null : (
                          <Button onClick={() => void handleActivate(character.id)} size="sm" variant="secondary">
                            Ativar
                          </Button>
                        )}
                        <Button onClick={() => openEdit(character)} size="sm" variant="ghost">
                          Editar
                        </Button>
                        <Button
                          onClick={() => setPendingDelete(character)}
                          size="sm"
                          variant="danger"
                        >
                          Remover
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Section>

          <aside className="account-rail" aria-label="Dados da conta">
            <h2>Conta e acesso</h2>
            <Card className="account-rail__content" tone="quiet">
              <div className="account-row">
                <span className="account-row__icon">
                  <Icon name="user" size={19} />
                </span>
                <div>
                  <strong>Email</strong>
                  <span>{user?.email}</span>
                </div>
              </div>
              <div className="account-row">
                <span className="account-row__icon">
                  <Icon name="swords" size={19} />
                </span>
                <div>
                  <strong>Personagem ativo</strong>
                  <span>
                    {activeCharacter
                      ? `${activeCharacter.name} · ${activeCharacter.vocation} ${activeCharacter.level}`
                      : "Selecione um personagem para personalizar as Hunts"}
                  </span>
                </div>
              </div>
              <div className="account-row">
                <span className="account-row__icon">
                  <Icon name="refresh" size={19} />
                </span>
                <div>
                  <strong>Sincronizar</strong>
                  <span>Recarregar personagens da API</span>
                </div>
                <Button onClick={() => void reloadCharacters()} size="sm" variant="ghost">
                  Atualizar
                </Button>
              </div>
            </Card>
          </aside>
        </div>
      </PageContainer>

      <Modal
        description="Os dados são enviados para a API existente do RuneCodex."
        footer={
          <>
            <Button onClick={() => setModalOpen(false)} variant="ghost">
              Cancelar
            </Button>
            <Button form="character-form" loading={saving} type="submit">
              Salvar
            </Button>
          </>
        }
        onClose={() => setModalOpen(false)}
        open={modalOpen}
        title={editingId ? "Editar personagem" : "Novo personagem"}
      >
        <form className="auth-form" id="character-form" onSubmit={handleSave}>
          <Input
            label="Nome"
            maxLength={50}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
            value={form.name}
          />
          <Select
            label="Vocação"
            onChange={(event) => setForm((current) => ({ ...current, vocation: event.target.value }))}
            options={VOCATIONS.map((vocation) => ({ label: vocation, value: vocation }))}
            value={form.vocation}
          />
          <Input
            label="Level"
            max={9999}
            min={1}
            onChange={(event) =>
              setForm((current) => ({ ...current, level: Number(event.target.value) || 1 }))
            }
            required
            type="number"
            value={form.level}
          />
          <Input
            label="Mundo"
            maxLength={50}
            onChange={(event) => setForm((current) => ({ ...current, world: event.target.value }))}
            required
            value={form.world}
          />
        </form>
      </Modal>

      <Modal
        description="Esta ação remove o personagem da sua conta."
        footer={
          <>
            <Button onClick={() => setPendingDelete(null)} variant="ghost">
              Cancelar
            </Button>
            <Button loading={saving} onClick={() => void handleDelete()} variant="danger">
              Remover
            </Button>
          </>
        }
        onClose={() => setPendingDelete(null)}
        open={Boolean(pendingDelete)}
        title="Remover personagem"
      >
        <p>
          {pendingDelete
            ? `Remover ${pendingDelete.name} (${pendingDelete.vocation} ${pendingDelete.level})?`
            : ""}
        </p>
      </Modal>

      {notice ? (
        <div className="toast-region">
          <Toast
            message={notice.message}
            onClose={() => setNotice(null)}
            title={notice.title}
            tone={notice.tone}
          />
        </div>
      ) : null}
    </div>
  );
}
