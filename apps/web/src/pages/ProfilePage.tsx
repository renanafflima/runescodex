import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { AccountDevices } from "./AccountDevices";
import { AccountReferrals } from "./AccountReferrals";
import { AccountTickets } from "./AccountTickets";
import { GoogleSignInButton } from "../components/auth/GoogleSignInButton";
import { PageContainer } from "../components/layout/PageContainer";
import { Section } from "../components/layout/Section";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/FormControls";
import { Icon } from "../components/ui/Icon";
import { Modal } from "../components/ui/Modal";
import { Toast } from "../components/ui/Toast";
import { CatalogEmpty, CatalogLoading } from "../components/catalog/CatalogState";
import { EMBLEM_CRITERION, PROFILE_EMBLEMS, type ProfileEmblem } from "../domain/profile-emblems";
import { initialsFrom } from "../domain/format";
import { VOCATIONS } from "../domain/vocation";
import { assetUrl } from "../lib/assets";
import { describeApiError } from "../services/api/errors";
import type { PremiumAccess, Character } from "../services/api/types";
import type { CharacterPayload } from "../services/api/characters";

const emptyForm: CharacterPayload = {
  name: "",
  vocation: "EK",
  level: 8,
  world: "",
};

function accessCopy(premium?: PremiumAccess) {
  if (!premium?.access) return "Compra única ainda não liberada";
  if (premium.channel === "staff") return "Acesso da equipe";
  if (premium.term === "FIXED") return "Acesso com prazo definido";
  return "Acesso de compra única";
}

function membershipDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(date);
}

export function ProfilePage() {
  const {
    user,
    linkGoogle,
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Character | null>(null);
  const [emblem, setEmblem] = useState<ProfileEmblem | null>(null);
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
    if (saving) return;
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
    if (!pendingDelete || saving) return;
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

  const memberSince = membershipDate(user?.createdAt);

  return (
    <div className="profile-page">
      <PageContainer className="profile-content" size="wide">
        <section className="profile-hero" aria-labelledby="profile-title">
          <img
            alt=""
            className="profile-hero__scene"
            src={assetUrl("images/profile/profile-hero.webp")}
          />
          <div className="profile-hero__shade" />
          <div className="profile-hero__inner">
            <div className="profile-identity">
              <div className="profile-identity__avatar" aria-hidden="true">
                {initialsFrom(user?.email || "R")}
              </div>
              <div className="profile-identity__copy">
                <p className="eyebrow">Perfil do aventureiro</p>
                <h1 id="profile-title">{user?.email || "Sua conta"}</h1>
                {activeCharacter ? (
                  <p className="profile-identity__character">
                    Personagem em uso: {activeCharacter.name} · {activeCharacter.vocation} {activeCharacter.level}
                  </p>
                ) : (
                  <p className="profile-identity__character">Nenhum personagem ativo</p>
                )}
                <p>
                  {memberSince ? `Cadastro em ${memberSince}. ` : ""}
                  {accessCopy(user?.premium)}
                </p>
              </div>
            </div>
            <Button onClick={() => setSettingsOpen(true)} type="button" variant="secondary">
              Configurações
            </Button>
          </div>
        </section>

        <section aria-label="Visão geral do jogador" className="profile-overview">
          <div>
            <strong>{characters.length}</strong>
            <span>Personagens</span>
          </div>
          <div>
            <strong>{activeCharacter?.name || "Nenhum"}</strong>
            <span>Personagem ativo</span>
          </div>
          <div>
            <strong>{user?.premium?.access ? "Liberado" : "Sem acesso"}</strong>
            <span>{accessCopy(user?.premium)}</span>
          </div>
          <div>
            <strong>{memberSince || "—"}</strong>
            <span>Cadastro</span>
          </div>
        </section>

        <Section
          actions={
            <div className="profile-section-actions">
              <Button onClick={() => void reloadCharacters()} size="sm" type="button" variant="ghost">
                Atualizar
              </Button>
              <Button onClick={openCreate} size="sm" type="button">
                Novo personagem
              </Button>
            </div>
          }
          className="profile-characters"
          description="O personagem ativo define vocação e level usados nas Hunts."
          eyebrow="Companhia"
          title="Personagens"
        >
          {characters.length === 0 ? (
            <CatalogEmpty
              action={
                <Button onClick={openCreate} type="button" variant="secondary">
                  Criar personagem
                </Button>
              }
              description="Cadastre o primeiro personagem para conectar as Hunts à sua conta."
              title="Nenhum personagem"
            />
          ) : (
            <div className="character-slots">
              {characters.map((character) => {
                const isActive = activeCharacter?.id === character.id;
                return (
                  <article className={isActive ? "character-slot character-slot--active" : "character-slot"} key={character.id}>
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
                        <Button onClick={() => void handleActivate(character.id)} size="sm" type="button" variant="secondary">
                          Ativar
                        </Button>
                      )}
                      <Button onClick={() => openEdit(character)} size="sm" type="button" variant="ghost">
                        Editar
                      </Button>
                      <Button onClick={() => setPendingDelete(character)} size="sm" type="button" variant="danger">
                        Remover
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Section>

        <Section
          className="profile-emblems"
          description="Os emblemas oficiais permanecem fechados até o servidor receber uma regra de desbloqueio aprovada."
          eyebrow="Jornada"
          title="Conquistas"
        >
          <p className="profile-emblems__count">0 / {PROFILE_EMBLEMS.length} conquistadas</p>
          <div className="emblem-gallery">
            {PROFILE_EMBLEMS.map((item) => (
              <button
                className="emblem emblem--locked"
                key={item.id}
                onClick={() => setEmblem(item)}
                type="button"
              >
                <span className="emblem__art">
                  <img alt="" src={item.image} />
                </span>
                <span className="emblem__name">{item.name}</span>
              </button>
            ))}
          </div>
        </Section>

        <AccountDevices />
        <AccountReferrals />
        <AccountTickets />
      </PageContainer>

      <Modal
        description="Os dados são enviados para a API existente do RuneCodex."
        footer={
          <>
            <Button onClick={() => setModalOpen(false)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={saving} form="character-form" loading={saving} type="submit">
              Salvar
            </Button>
          </>
        }
        onClose={() => setModalOpen(false)}
        open={modalOpen}
        title={editingId ? "Editar personagem" : "Novo personagem"}
      >
        <form className="auth-form" id="character-form" onSubmit={(event) => void handleSave(event)}>
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
        description="Conta, acesso e sessão deste navegador."
        footer={
          <Button onClick={() => void logout()} type="button" variant="secondary">
            Sair
          </Button>
        }
        onClose={() => setSettingsOpen(false)}
        open={settingsOpen}
        title="Configurações"
      >
        <div className="account-rail__content">
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
              <Icon name="user" size={19} />
            </span>
            <div>
              <strong>Google</strong>
              <span>
                {user?.googleLinked
                  ? "Conta Google vinculada"
                  : "Vincule a mesma conta de email para entrar com o Google"}
              </span>
            </div>
            {user?.googleLinked ? null : (
              <GoogleSignInButton
                fullWidth={false}
                label="Vincular Google"
                onCredential={async (credential) => {
                  await linkGoogle(credential);
                  setNotice({
                    title: "Google vinculado",
                    message: "Você já pode entrar com o Google.",
                    tone: "success",
                  });
                }}
                onError={(message) =>
                  setNotice({
                    title: "Não foi possível vincular o Google",
                    message,
                    tone: "error",
                  })
                }
                showUnavailable={false}
                size="sm"
              />
            )}
          </div>
          <div className="account-row">
            <span className="account-row__icon">
              <Icon name="crown" size={19} />
            </span>
            <div>
              <strong>Acesso</strong>
              <span>{accessCopy(user?.premium)}</span>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        description={emblem?.summary}
        onClose={() => setEmblem(null)}
        open={Boolean(emblem)}
        title={emblem?.name || "Conquista"}
      >
        {emblem ? (
          <div className="emblem-detail">
            <img alt="" src={emblem.image} />
            <p>Estado atual: não conquistada.</p>
            <p>{EMBLEM_CRITERION}</p>
            <p>Não há progresso nem data de conquista, porque nenhuma métrica foi aprovada.</p>
          </div>
        ) : null}
      </Modal>

      <Modal
        description="Esta ação remove o personagem da sua conta."
        footer={
          <>
            <Button onClick={() => setPendingDelete(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={saving} loading={saving} onClick={() => void handleDelete()} type="button" variant="danger">
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
