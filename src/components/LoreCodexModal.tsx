import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, Sparkles, X } from 'lucide-react';
import { CODEX_LETTER_ZERO } from '../lib/lore';
import { soundscape } from '../lib/soundscape';

interface LoreCodexModalProps {
  open: boolean;
  onClose: () => void;
  onStartCutscene?: () => void;
}

export const LoreCodexModal: React.FC<LoreCodexModalProps> = ({
  open,
  onClose,
  onStartCutscene,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
              soundscape.playUiSfx('close');
            }
          }}
        >
          <motion.div
            className="paper-sheet lore-codex-sheet"
            data-tint="cream"
            initial={{ scale: 0.92, opacity: 0, y: 14 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lore-codex-title"
          >
            <div className="paper-header">
              <div className="paper-meta" id="lore-codex-title">
                <Sparkles size={15} />
                <span>{CODEX_LETTER_ZERO.number} · Cathexis</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  soundscape.playUiSfx('close');
                }}
                className="paper-subtle-btn"
                aria-label="Close Letter #0"
              >
                <span>Close</span>
                <X size={13} />
              </button>
            </div>

            <div className="lore-codex-body">
              <h2 className="lore-codex-heading">{CODEX_LETTER_ZERO.title}</h2>
              <blockquote className="lore-codex-epigraph">
                {CODEX_LETTER_ZERO.epigraph}
              </blockquote>
              {CODEX_LETTER_ZERO.body.map((para, idx) => (
                <p key={idx} className="paper-text lore-codex-para">
                  {para}
                </p>
              ))}
            </div>

            <div className="paper-footer">
              <span>Keeper of the Wind · Sanctuary Archive</span>
              {onStartCutscene && (
                <button
                  type="button"
                  className="paper-subtle-btn"
                  onClick={() => {
                    onClose();
                    onStartCutscene();
                  }}
                >
                  <MessageCircle size={13} />
                  <span>Talk to the Frog</span>
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
