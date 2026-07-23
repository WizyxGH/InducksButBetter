import React from "react";
import { Star, Eye, Cat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface Character {
  charactercode: string;
  charactername: string;
  official?: string;
  onetime?: string;
  heroonly?: string;
  appearances?: number;
  imageUrl?: string;
}

interface CharacterResultCardProps {
  char: Character;
  onSelect: (code: string) => void;
}

export function CharacterResultCard({ char, onSelect }: CharacterResultCardProps) {
  const hasThumb = char.imageUrl && char.imageUrl.includes("|");
  const thumbUrl = hasThumb
    ? `/api/proxy-image?url=${encodeURIComponent(char.imageUrl!.split("|")[1])}`
    : null;

  return (
    <Card
      className="p-4 cursor-pointer hover:bg-surface-2 hover:border-primary/25 hover:shadow-md transition-all duration-300 group flex items-start gap-4 border border-border-subtle bg-surface-2/20 rounded-2xl h-[120px] overflow-hidden"
      onClick={() => onSelect(char.charactercode)}
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={char.charactername}
          className="w-16 h-16 rounded-xl object-cover border border-border-subtle shrink-0 shadow-sm"
        />
      ) : (
        <div className="w-16 h-16 rounded-xl bg-surface-3 flex items-center justify-center border border-border-subtle shrink-0">
          <Cat className="w-6 h-6 text-muted-foreground/40" />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
              {char.charactername}
            </h3>
            {char.heroonly === "Y" && (
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
            )}
          </div>
          <p className="text-[10px] text-muted-foreground font-mono truncate">{char.charactercode}</p>
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-border-subtle/30">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            {char.official === "Y" && (
              <Badge variant="secondary" className="px-1 py-0 text-[8px] h-3.5 bg-primary/20 text-primary border-none">
                OFFICIEL
              </Badge>
            )}
            {char.onetime === "Y" && (
              <Badge variant="secondary" className="px-1 py-0 text-[8px] h-3.5 bg-muted-foreground/20 text-muted-foreground border-none">
                1 FOIS
              </Badge>
            )}
          </span>
          <span className="font-semibold text-foreground flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-primary shrink-0" />
            {char.appearances || 0}
          </span>
        </div>
      </div>
    </Card>
  );
}
