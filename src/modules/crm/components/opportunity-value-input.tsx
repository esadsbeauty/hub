import { Input } from "@/components/ui/input";
import {
  formatOpportunityValueInput,
  parseOpportunityValueInput,
} from "../utils/opportunity-value";

export function OpportunityValueInput({
  value,
  onChange,
  disabled,
  id,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label="Valor da oportunidade em reais"
      value={formatOpportunityValueInput(value)}
      disabled={disabled}
      onChange={(event) => onChange(parseOpportunityValueInput(event.target.value))}
    />
  );
}
