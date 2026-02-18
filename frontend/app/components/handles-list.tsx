import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface Handle {
  id: string;
  value: string;
  type: 'account' | 'team' | 'channel';
  isPrimary: boolean;
  isSearchable: boolean;
}

interface HandlesListProps {
  handles: Handle[];
  selectedHandleId: string | null;
  onSelectHandle: (id: string) => void;
  onCreateHandle: () => void;
  isLoading?: boolean;
}

export function HandlesList({
  handles,
  selectedHandleId,
  onSelectHandle,
  onCreateHandle,
  isLoading,
}: HandlesListProps) {
  return (
    <div className="flex flex-col gap-2">
      {isLoading ? (
        <div className="h-40 bg-primary/5 rounded-lg animate-pulse" />
      ) : (
        <>
          {handles.map(handle => (
            <button
              key={handle.id}
              onClick={() => onSelectHandle(handle.id)}
              className={`p-3 rounded-lg text-left transition-colors ${
                selectedHandleId === handle.id
                  ? 'bg-primary/20 border border-primary'
                  : 'bg-primary/5 hover:bg-primary/10 border border-transparent'
              }`}
            >
              <div className="font-bold">@{handle.value}</div>
              {handle.alias && (
                <div className="text-xs text-foreground/50 mb-1">alias: @{handle.alias}</div>
              )}
              <div className="text-xs text-foreground/60 space-x-2">
                {handle.isPrimary && (
                  <span className="inline-block bg-primary/20 px-2 py-0.5 rounded text-primary text-[10px] font-bold">
                    Primary
                  </span>
                )}
                {handle.isSearchable && (
                  <span className="inline-block bg-primary/10 px-2 py-0.5 rounded text-primary/60 text-[10px] font-bold">
                    Searchable
                  </span>
                )}
              </div>
            </button>
          ))}
          <button
            onClick={onCreateHandle}
            className="p-3 rounded-lg border-2 border-dashed border-primary/40 hover:border-primary text-primary transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create New Handle
          </button>
        </>
      )}
    </div>
  );
}
