import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ChocoboRating } from '@/ff7/encwfile'
import { ChocoboRating as ChocoboRatingEnum } from '@/hooks/types'

// Get chocobo rating names from the enum
const getChocoboRatingNames = (): string[] => {
  const names: string[] = []
  for (let i = 1; i <= 8; i++) {
    // Find the key that corresponds to this numeric value
    const key = Object.keys(ChocoboRatingEnum).find(k => (ChocoboRatingEnum as any)[k] === i)
    if (key) {
      names.push(key)
    }
  }
  return names
}

const CHOCOBO_RATING_NAMES = getChocoboRatingNames()

interface ChocoboEncounterEditorProps {
  encounter: ChocoboRating
  index: number
  onUpdate: (index: number, updates: Partial<ChocoboRating>) => void
}

function ChocoboEncounterEditor({ encounter, index, onUpdate }: ChocoboEncounterEditorProps) {
  return (
    <div className="flex items-center gap-2 p-2 border rounded">
      <Label className="w-12 text-sm font-normal">#{index + 1}</Label>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Label className="text-xs">Battle ID:</Label>
          <Input
            type="number"
            min="0"
            max="1023"
            value={encounter.battleSceneId}
            onChange={(e) => onUpdate(index, { battleSceneId: parseInt(e.target.value) || 0 })}
            className="w-20 h-7 text-xs"
          />
        </div>
        <div className="flex items-center gap-1">
          <Label className="text-xs">Rating:</Label>
          <Select
            value={encounter.rating.toString()}
            onValueChange={(value) => onUpdate(index, { rating: parseInt(value) })}
          >
            <SelectTrigger className="w-28 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHOCOBO_RATING_NAMES.map((name, ratingIndex) => (
                <SelectItem key={ratingIndex + 1} value={(ratingIndex + 1).toString()}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

interface ChocoboEncountersProps {
  chocoboRatings: ChocoboRating[]
  updateChocobo: (index: number, updates: Partial<ChocoboRating>) => void
}

export function ChocoboEncounters({
  chocoboRatings,
  updateChocobo
}: ChocoboEncountersProps) {

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4">
        <div className="mb-4">
          <h3 className="text-lg font-medium">Chocobo Ratings</h3>
          <p className="text-sm text-muted-foreground">
            Configure which chocobo encounters map to which ratings
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {chocoboRatings.map((rating, index) => (
            <ChocoboEncounterEditor
              key={index}
              encounter={rating}
              index={index}
              onUpdate={updateChocobo}
            />
          ))}
        </div>
      </div>
    </div>
  )
}