import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { bloomStages } from '@/lib/fixtures'

export default function StageFilter({ value, onChange }: { value: string; onChange: (stage: string) => void }) {
  return <Select value={value} onValueChange={(stage) => { if (stage) onChange(stage) }}>
    <SelectTrigger id="bloom-stage" aria-label="Nach Lernstufe filtern"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="Alle Lernstufen">Alle Lernstufen</SelectItem>
      {bloomStages.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}
    </SelectContent>
  </Select>
}
