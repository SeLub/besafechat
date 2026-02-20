import { LifeBuoy, BookOpen, MessageSquare, Github, ExternalLink, ShieldCheck } from 'lucide-react';
import { ResponsiveModal } from './ui/responsive-modal';

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpSupportModal({ isOpen, onClose }: HelpSupportModalProps) {
  const supportLinks = [
    {
      title: 'Documentation',
      desc: 'Learn how to use Sky features',
      icon: <BookOpen size={18} />,
      href: '#',
    },
    {
      title: 'Contact Support',
      desc: 'Get help from our team',
      icon: <MessageSquare size={18} />,
      href: '#',
    },
    {
      title: 'Github',
      desc: 'Report a bug or contribute',
      icon: <Github size={18} />,
      href: 'https://github.com',
    },
  ];

  return (
    <ResponsiveModal isOpen={isOpen} onClose={onClose} title="Support">
      <div className="space-y-6 pb-2">
        {/* Анимированный баннер */}
        <div className="relative overflow-hidden p-6 rounded-[2.5rem] bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
          <LifeBuoy className="absolute -right-4 -bottom-4 h-24 w-24 text-primary/10 -rotate-12" />
          <h4 className="text-sm font-black italic mb-1 uppercase tracking-tight">Need a Hand?</h4>
          <p className="text-[11px] text-muted-foreground max-w-[180px] leading-relaxed">
            Our community and team are here to ensure your privacy stays protected.
          </p>
        </div>

        {/* Ссылки */}
        <div className="grid gap-3">
          {supportLinks.map((link, i) => (
            <a
              key={i}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center justify-between p-4 rounded-[1.5rem] bg-primary/5 border border-transparent hover:border-primary/10 hover:bg-primary/10 transition-all duration-300"
            >
              <div className="flex items-center space-x-4">
                <div className="p-2.5 bg-background rounded-xl text-primary/60 group-hover:text-primary group-hover:scale-110 transition-all">
                  {link.icon}
                </div>
                <div>
                  <div className="font-bold text-[13px]">{link.title}</div>
                  <div className="text-[10px] text-muted-foreground">{link.desc}</div>
                </div>
              </div>
              <ExternalLink
                size={14}
                className="text-primary/20 group-hover:text-primary transition-colors"
              />
            </a>
          ))}
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-primary/5">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-2">
              <ShieldCheck size={14} className="text-primary/40" />
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/40">
                Sky v1.2.0-beta
              </span>
            </div>
            <button className="text-[10px] font-bold text-primary hover:underline transition-all">
              Terms of Service
            </button>
          </div>
        </div>
      </div>
    </ResponsiveModal>
  );
}
