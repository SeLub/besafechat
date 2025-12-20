import { useEffect } from 'react';

export default function DesignPreview() {
  // Добавим переключение темы
  useEffect(() => {
    const toggle = document.createElement('button');
    toggle.textContent = 'Toggle Theme';
    toggle.className =
      'fixed bottom-4 right-4 px-4 py-2 bg-primary text-primary-foreground rounded';
    toggle.onclick = () => document.documentElement.classList.toggle('dark');
    document.body.appendChild(toggle);

    return () => {
      document.body.removeChild(toggle);
    };
  }, []);

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Left Column */}
      <div className="w-80 border-r border-border">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Chats</h2>
        </div>
        <div className="p-2">
          <div className="flex items-center gap-3 p-3 rounded-lg cursor-pointer bg-accent">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
              S
            </div>
            <div>
              <div className="font-medium">Saved Messages</div>
              <div className="text-sm text-muted-foreground">You: Hello!</div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Column */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-border flex items-center">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
            J
          </div>
          <div className="ml-3">
            <div className="font-medium">John Doe</div>
            <div className="text-sm text-muted-foreground">Online</div>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          <div className="mb-2 p-2 bg-muted rounded-lg max-w-xs">Hi!</div>
          <div className="mb-2 p-2 bg-primary text-primary-foreground ml-auto rounded-lg max-w-xs">
            Hello!
          </div>
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex">
            <input
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 bg-muted rounded-l-lg outline-none"
            />
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-r-lg">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
