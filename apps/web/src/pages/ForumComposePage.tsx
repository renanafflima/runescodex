import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { Button, ButtonLink } from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/FormControls";
import { Toast } from "../components/ui/Toast";
import {
  FORUM_BODY_MAX,
  FORUM_CATEGORIES,
  FORUM_TITLE_MAX,
  composeForumBody,
  forumComposeIsDirty,
  validateForumCompose,
  type ForumComposeValues,
} from "../domain/forum";
import { describeApiError } from "../services/api/errors";
import { createForumThread } from "../services/api/forum";

const EMPTY_VALUES: ForumComposeValues = {
  title: "",
  category: "",
  body: "",
  level: "",
  vocation: "",
  goal: "",
  xpPerHour: "",
  profitPerHour: "",
};

export function ForumComposePage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(EMPTY_VALUES);
  const [errors, setErrors] = useState<ReturnType<typeof validateForumCompose>>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    title: string;
    tone: "info" | "success" | "error";
  } | null>(null);
  const [published, setPublished] = useState(false);

  const dirty = useMemo(() => !published && forumComposeIsDirty(values), [published, values]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function confirmDiscard() {
    return !dirty || window.confirm("Descartar o texto preenchido?");
  }

  function update<K extends keyof ForumComposeValues>(key: K, value: ForumComposeValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateForumCompose(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setNotice(null);
    try {
      const category = values.category;
      const thread = await createForumThread({
        title: values.title.trim(),
        body: composeForumBody(values),
        category,
      });
      setPublished(true);
      setNotice({
        title: "Discussão publicada",
        message: "Redirecionando para o tópico criado.",
        tone: "success",
      });
      navigate(`/forum/${thread.id}`, { replace: true, state: { created: true } });
    } catch (err) {
      setNotice({
        title: "Não foi possível publicar",
        message: describeApiError(err),
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="forum-page forum-page--compose">
      <PageContainer className="forum-page__inner forum-compose" size="narrow">
        <Link
          className="forum-back"
          onClick={(event) => {
            if (!confirmDiscard()) event.preventDefault();
          }}
          to="/forum"
        >
          ← Voltar ao fórum
        </Link>
        <header className="forum-compose__intro">
          <span className="forum-hero__kicker">Nova discussão</span>
          <h1>Criar discussão</h1>
          <p>
            Escreva um título claro, escolha a categoria e explique o contexto. Level, vocação e
            números de hunt são opcionais.
          </p>
        </header>

        <form className="forum-compose__form" onSubmit={handleSubmit} noValidate>
          <Input
            error={errors.title}
            hint="Faça uma pergunta ou resuma o assunto em uma frase."
            label="Título"
            maxLength={FORUM_TITLE_MAX}
            onChange={(event) => update("title", event.target.value)}
            placeholder="Ex.: Qual hunt vocês recomendam para esse level?"
            required
            value={values.title}
          />
          <Select
            error={errors.category}
            hint="Use a categoria que melhor descreve o assunto."
            label="Categoria"
            onChange={(event) => update("category", event.target.value)}
            options={[
              { value: "", label: "Selecione uma categoria" },
              ...FORUM_CATEGORIES.map((item) => ({ value: item.id, label: item.label })),
            ]}
            required
            value={values.category}
          />
          <Textarea
            error={errors.body}
            hint="Explique o que já tentou, o objetivo e qualquer detalhe que ajude a responder."
            label="Conteúdo"
            maxLength={FORUM_BODY_MAX}
            onChange={(event) => update("body", event.target.value)}
            placeholder="Descreva o contexto da dúvida ou da dica que você quer compartilhar."
            required
            rows={10}
            value={values.body}
          />

          <fieldset className="forum-compose__context">
            <legend>Contexto opcional da hunt</legend>
            <p>Preencha só o que for útil. Esses dados entram no conteúdo da discussão.</p>
            <div className="forum-compose__grid">
              <Input
                inputMode="numeric"
                label="Level"
                onChange={(event) => update("level", event.target.value)}
                placeholder="250"
                value={values.level}
              />
              <Input
                label="Vocação"
                onChange={(event) => update("vocation", event.target.value)}
                placeholder="EK, RP, ED..."
                value={values.vocation}
              />
              <Input
                label="Objetivo"
                onChange={(event) => update("goal", event.target.value)}
                placeholder="XP, profit, bestiário..."
                value={values.goal}
              />
              <Input
                label="XP / hora"
                onChange={(event) => update("xpPerHour", event.target.value)}
                placeholder="2.5kk"
                value={values.xpPerHour}
              />
              <Input
                label="Profit / hora"
                onChange={(event) => update("profitPerHour", event.target.value)}
                placeholder="400k"
                value={values.profitPerHour}
              />
            </div>
          </fieldset>

          <div className="forum-compose__actions">
            <Button disabled={submitting} loading={submitting} type="submit">
              Publicar discussão
            </Button>
            <ButtonLink
              onClick={(event) => {
                if (!confirmDiscard()) event.preventDefault();
              }}
              to="/forum"
              variant="ghost"
            >
              Cancelar
            </ButtonLink>
          </div>
        </form>
      </PageContainer>
      {notice ? (
        <Toast
          message={notice.message}
          onClose={() => setNotice(null)}
          title={notice.title}
          tone={notice.tone}
        />
      ) : null}
    </div>
  );
}
