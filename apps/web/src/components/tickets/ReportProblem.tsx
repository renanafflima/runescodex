import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../services/api/errors";
import { apiRequest } from "../../services/api/client";
import { Button } from "../ui/Button";

type ReportProblemProps = {
  origin: "HUNT" | "BESTIARY";
  huntId?: string;
  creatureId?: string;
};

const PROBLEMS = [
  { value: "INCORRECT_INFO", label: "Informação incorreta" },
  { value: "HUNT_OUTDATED", label: "Conteúdo desatualizado" },
  { value: "XP_PER_HOUR", label: "XP/h" },
  { value: "PROFIT", label: "Lucro/h" },
  { value: "DIFFICULTY", label: "Dificuldade" },
  { value: "BESTIARY", label: "Bestiário" },
  { value: "OTHER", label: "Outro" },
];

export function ReportProblem({ origin, huntId, creatureId }: ReportProblemProps) {
  const { isAuthenticated } = useAuth();
  const [problemType, setProblemType] = useState(origin === "BESTIARY" ? "BESTIARY" : "INCORRECT_INFO");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (description.trim().length < 5 || pending) return;
    setPending(true);
    setNotice("");
    try {
      const created = await apiRequest<{ protocol: string }>("/tickets", {
        method: "POST",
        auth: true,
        json: {
          problemType,
          impact: "MEDIUM",
          origin,
          description: description.trim(),
          huntId,
          creatureId,
        },
      });
      setDescription("");
      setNotice(`Chamado ${created.protocol} aberto. A equipe responde por aqui quando houver uma mensagem pública.`);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 403) {
        setNotice("A abertura de chamados segue a regra de acesso já existente da conta.");
      } else if (caught instanceof ApiError) {
        setNotice(caught.message || "Não foi possível abrir o chamado.");
      } else {
        setNotice("Não foi possível abrir o chamado.");
      }
    } finally {
      setPending(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <p>
        Encontrou um problema neste conteúdo? <Link to="/login">Entre</Link> para abrir um chamado.
      </p>
    );
  }

  return (
    <form className="hunt-update" onSubmit={(event) => void submit(event)}>
      <h2>Reportar um problema</h2>
      <p>O chamado usa o fluxo oficial. Não há um segundo sistema de tickets.</p>
      <label htmlFor={`report-type-${origin}`}>
        Categoria
        <select id={`report-type-${origin}`} onChange={(event) => setProblemType(event.target.value)} value={problemType}>
          {PROBLEMS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={`report-body-${origin}`}>
        Descrição
        <textarea id={`report-body-${origin}`} maxLength={5000} onChange={(event) => setDescription(event.target.value)} value={description} />
      </label>
      <Button disabled={pending || description.trim().length < 5} loading={pending} type="submit">
        Abrir chamado
      </Button>
      {notice ? <p role="status">{notice}</p> : null}
    </form>
  );
}
