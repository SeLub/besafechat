import { HamburgerMenu } from '@/components/hamburger-menu';
import { ChatList } from '@/components/chat-list';
import { LeftPanelPages } from '@/components/left-panel-pages';

interface LeftColumnProps {
  leftPanelPage: 'profile' | 'settings' | 'contacts' | null;
  userProfile: any;
  chats: any[];
  selectedChatId?: string;
  onProfileClick: () => void;
  onContactsClick: () => void;
  onSettingsClick: () => void;
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
  onProfileClick,
  onContactsClick,
  onSettingsClick,
  onBackToChats,
  onChatSelect,
  onNewChat,
  onChatCreated,
}: LeftColumnProps) {
  return (
    <div id="LeftColumn" className="w-80 border-r border-border flex flex-col">
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
          <div className="flex items-center justify-between p-4 border-b border-border">
            <HamburgerMenu
              userProfile={userProfile}
              onProfileClick={onProfileClick}
              onContactsClick={onContactsClick}
              onSettingsClick={onSettingsClick}
            />
            <h2 className="text-lg font-semibold">BeSafeChat</h2>
            <div className="w-10" />
          </div>

          {/* Chat List */}
          <ChatList
            chats={chats}
            selectedChatId={selectedChatId}
            onChatSelect={onChatSelect}
            onNewChat={onNewChat}
          />
        </>
      )}
    </div>
  );
}
