import { ChatList } from '@/components/chat-list';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { LeftPanelPages } from '@/components/left-panel-pages';

interface LeftColumnProps {
  leftPanelPage: 'profile' | 'settings' | 'contacts' | 'notifications' | null;
  userProfile: any;
  chats: any[];
  selectedChatId?: string;
  onHandleClick: () => void;
  onProfileClick: () => void;
  onContactsClick: () => void;
  onSettingsClick: () => void;
  onNotificationsClick: () => void;
  onBackToChats: () => void;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
  onChatCreated: (chatId: string) => void;
}

export function LeftColumn({
  leftPanelPage,
  userProfile,
  chats,
  selectedChatId,
  onHandleClick,
  onProfileClick,
  onContactsClick,
  onSettingsClick,
  onNotificationsClick,
  onBackToChats,
  onChatSelect,
  onNewChat,
  onChatCreated,
}: LeftColumnProps) {
  return (
    <div
      id="LeftColumn"
      className="w-full md:w-80 border-r border-primary/5 bg-card/30 backdrop-blur-xl flex flex-col shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]"
    >
      {leftPanelPage ? (
        <LeftPanelPages
          page={leftPanelPage}
          onBack={onBackToChats}
          userProfile={userProfile}
          onChatCreated={onChatCreated}
        />
      ) : (
        <>
          {/* Header with Hamburger Menu */}
          <div className="flex items-center justify-between p-4 mb-2">
            <HamburgerMenu
              userProfile={userProfile}
              onHandleClick={onHandleClick}
              onProfileClick={onProfileClick}
              onContactsClick={onContactsClick}
              onSettingsClick={onSettingsClick}
              onNotificationsClick={onNotificationsClick}
            />
            <h2 className="text-xl font-black tracking-tighter text-foreground italic">
              Leteem<span className="text-primary not-italic">.</span>
            </h2>
            <div className="w-10" />
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-hidden px-2">
            <ChatList
              chats={chats}
              selectedChatId={selectedChatId}
              onChatSelect={onChatSelect}
              onNewChat={onNewChat}
            />
          </div>
        </>
      )}
    </div>
  );
}
