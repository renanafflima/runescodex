import { useAuth } from "../../auth/AuthContext";
import { describeApiError } from "../../services/api/errors";

type CharacterSwitcherProps = {
  className?: string;
  id?: string;
};

export function CharacterSwitcher({ className = "", id = "active-character" }: CharacterSwitcherProps) {
  const { characters, activeCharacter, setActiveCharacter } = useAuth();

  if (!characters?.length) return null;

  async function onChange(characterId: string) {
    if (!characterId || characterId === activeCharacter?.id) return;
    try {
      await setActiveCharacter(characterId);
    } catch (error) {
      window.alert(describeApiError(error));
    }
  }

  return (
    <label className={`character-switcher ${className}`.trim()} htmlFor={id}>
      <span>Personagem principal</span>
      <select
        id={id}
        onChange={(event) => void onChange(event.target.value)}
        value={activeCharacter?.id || ""}
      >
        {activeCharacter ? null : (
          <option disabled value="">
            Selecione um personagem
          </option>
        )}
        {characters.map((character) => (
          <option key={character.id} value={character.id}>
            {character.name} · {character.vocation} {character.level}
          </option>
        ))}
      </select>
    </label>
  );
}
