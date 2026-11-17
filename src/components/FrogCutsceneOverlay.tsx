import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Feather, X } from 'lucide-react';
import { FROG_CUTSCENE_NODES } from '../lib/lore';
import { soundscape } from '../lib/soundscape';

interface FrogCutsceneOverlayProps {
  open: boolean;
  onExit: () => void;
  onOpenLetterZero: () => void;
  onFrogReact: () => void;
}

export const FrogCutsceneOverlay: React.FC<FrogCutsceneOverlayProps> = ({
  open,
  onExit,
  onOpenLetterZero,
  onFrogReact,
}) => {
  const [nodeId, setNodeId] = useState<string>('start');

  useEffect(() => {
    if (open) {
      setNodeId('start');
    }
  }, [open]);

  const node = FROG_CUTSCENE_NODES[nodeId] ?? FROG_CUTSCENE_NODES.start;

  const goToNode = (nextId: string) => {
    const nextNode = FROG_CUTSCENE_NODES[nextId];
    if (!nextNode) return;
    setNodeId(nextId);
    soundscape.playUiSfx('tap');
    if (nextNode.frogReact) {
      onFrogReact();
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
        return;
      }
      if ((e.key === ' ' || e.key === 'Enter') && node.nextId && !node.choices) {
        e.preventDefault();
        goToNode(node.nextId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, node, onExit]);

  const handleBoxClick = () => {
    if (node.nextId && !node.choices) {
      goToNode(node.nextId);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="vn-cutscene-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
          role="dialog"
          aria-modal="true"
          aria-label="Conversation with Jeff"
        >
          {/* Subtle top cinematic bar + Exit Cutscene button */}
          <div className="vn-cutscene-topbar">
            <span className="vn-cutscene-badge">By the Lantern Shrine</span>
            <button
              type="button"
              className="vn-exit-btn"
              onClick={() => {
                soundscape.playUiSfx('close');
                onExit();
              }}
            >
              <span>Exit Cutscene</span>
              <X size={13} />
            </button>
          </div>

          {/* Bottom Visual Novel Dialogue Box */}
          <motion.div
            className="vn-dialogue-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className={`vn-dialogue-box ${node.nextId && !node.choices ? 'is-clickable' : ''}`}
              onClick={handleBoxClick}
            >
              <div className="vn-speaker-row">
                <span className={`vn-speaker-pill speaker-${node.speaker}`}>
                  {node.speaker === 'frog'
                    ? 'Jeff'
                    : node.speaker === 'you'
                      ? 'You'
                      : 'Narrator'}
                </span>
              </div>

              <motion.p
                key={node.id}
                className={`vn-dialogue-text ${node.speaker === 'narration' ? 'is-narration' : ''}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
              >
                {node.text}
              </motion.p>

              {node.choices && node.choices.length > 0 && (
                <div className="vn-choices-list" onClick={(e) => e.stopPropagation()}>
                  {node.choices.map((choice) => (
                    <button
                      key={choice.nextId}
                      type="button"
                      className="vn-choice-btn"
                      onClick={() => goToNode(choice.nextId)}
                    >
                      <span>{choice.label}</span>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </div>
              )}

              {node.nextId && !node.choices && (
                <div className="vn-continue-hint">
                  <span>Click to continue</span>
                  <ChevronRight size={13} />
                </div>
              )}

              {node.isEnd && (
                <div className="vn-end-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="vn-action-primary"
                    onClick={() => {
                      soundscape.playUiSfx('open');
                      onOpenLetterZero();
                    }}
                  >
                    <Feather size={13} />
                    <span>Read Letter #0</span>
                  </button>
                  <button
                    type="button"
                    className="vn-action-secondary"
                    onClick={() => {
                      soundscape.playUiSfx('close');
                      onExit();
                    }}
                  >
                    <span>Exit Cutscene</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
