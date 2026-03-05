import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, Card } from './index';

interface EditModalProps {
  title: string;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
  saveLabel?: string;
  saving?: boolean;
}

export function EditModal({ title, onClose, onSave, children, saveLabel = 'Save Changes', saving }: EditModalProps) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-xl animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e6f0]">
          <h2 className="font-bold text-sm font-display text-[#1a1d2e]">{title}</h2>
          <button onClick={onClose} className="text-[#8b90a8] hover:text-[#1a1d2e] transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          {children}
        </div>
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-[#e2e6f0] bg-[#f4f6fb] rounded-b-[16px]">
          <Button variant="secondary" onClick={onClose} size="sm">Cancel</Button>
          <Button onClick={onSave} size="sm" loading={saving}>{saveLabel}</Button>
        </div>
      </Card>
    </div>
  );
}
