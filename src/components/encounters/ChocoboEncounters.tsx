import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BattleAutocompleteModal } from '@/components/ui/battle-autocomplete'
import type { ChocoboRating } from '@/ff7/encwfile'
import { ChocoboRating as ChocoboRatingEnum } from '@/hooks/types'
import type { BattleScene } from '@/hooks/types'

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

interface ChocoboEncounterRowProps {
  encounter: ChocoboRating
  index: number
  onUpdate: (index: number, updates: Partial<ChocoboRating>) => void
  battleScenes: BattleScene[]
}

function ChocoboEncounterRow({ encounter, index, onUpdate, battleScenes }: ChocoboEncounterRowProps) {
  return (
    <div className="flex items-center gap-4 p-3 border rounded">
      <Label className="w-16 text-sm font-normal flex-shrink-0">#{index + 1}</Label>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Label className="text-xs flex-shrink-0">Battle ID:</Label>
        <div className="flex-1 min-w-0">
          <BattleAutocompleteModal
            battleScenes={battleScenes}
            value={encounter.battleSceneId}
            onSelect={(id) => {
              onUpdate(index, { battleSceneId: id ?? 0 });
            }}
            placeholder="Click to search battles..."
          />
        </div>
      </div>
      <div className="flex items-center gap-2 w-40 flex-shrink-0">
        <Label className="text-xs flex-shrink-0">Rating:</Label>
        <Select
          value={encounter.rating.toString()}
          onValueChange={(value) => onUpdate(index, { rating: parseInt(value) })}
        >
          <SelectTrigger className="w-32 h-7 text-xs">
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
  )
}

interface ChocoboEncountersProps {
  chocoboRatings: ChocoboRating[]
  updateChocobo: (index: number, updates: Partial<ChocoboRating>) => void
  battleScenes: BattleScene[]
}

export function ChocoboEncounters({
  chocoboRatings,
  updateChocobo,
  battleScenes
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

        <div className="space-y-2">
          {chocoboRatings.map((rating, index) => (
            <ChocoboEncounterRow
              key={index}
              encounter={rating}
              index={index}
              onUpdate={updateChocobo}
              battleScenes={battleScenes}
            />
          ))}
        </div>
      </div>
    </div>
  )
}