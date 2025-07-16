
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import XIcon from './icons/XIcon';
import MongoIcon from './icons/MongoIcon';

// Define the structure of a tutorial step
interface TutorialStep {
  targetId: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'right' | 'left' | 'center' | 'top-inside';
}

// Define all the steps for our guided tour
const tutorialSteps: TutorialStep[] = [
  {
    targetId: 'modal',
    title: 'Welcome to QueryPal!',
    content: 'This quick tour will walk you through the main features. You can exit at any time.',
  },
  {
    targetId: 'tutorial-account-section',
    title: '1. Connect to a Database',
    content: 'Start by selecting an Azure account, then choose a database. The app only discovers resources you have permission to access.',
    placement: 'bottom',
  },
  {
    targetId: 'tutorial-collection-panel',
    title: '2. Target a Collection',
    content: 'Click a collection to see its schema. When a collection is selected, the AI uses its schema to generate more accurate queries.',
    placement: 'top',
  },
  {
    targetId: 'tutorial-prompt-section',
    title: '3. Generate a Query',
    content: "Write a command in plain English, then click 'Generate Query' to have the AI assistant create the code for you.",
    placement: 'top',
  },
  {
    targetId: 'query-display-panel',
    title: '4. Run & Edit Query',
    content: "Click 'Run Query' to execute the code against the database. You can also edit the code directly in the text area before running.",
    placement: 'top',
  },
  {
    targetId: 'tutorial-save-button',
    title: '5. Save Your Queries',
    content: "Like a query? Click 'Save' to add it to your personal collection for later use.",
    placement: 'bottom',
  },
  {
    targetId: 'tutorial-saved-queries-button',
    title: '6. Access Saved Queries',
    content: 'Click the bookmark icon in the header at any time to open your collection of saved and shared queries.',
    placement: 'center',
  },
  {
    targetId: 'tutorial-saved-queries-panel',
    title: '7. Manage & Share Queries',
    content: "This panel shows your saved queries and those shared with you. You can load, edit, and share your own queries with colleagues via email.",
    placement: 'left',
  },
  {
    targetId: 'tutorial-results-area',
    title: '8. Debug with AI',
    content: "In case of an execution error, click 'Debug with AI' and the assistant will analyze the problem and suggest a fix.",
    placement: 'top',
  },
  {
    targetId: 'tutorial-view-switcher',
    title: '9. View Your Results',
    content: "After a successful run, your results appear here. You can switch between a raw JSON view, an interactive Graph, and a powerful Table view.",
    placement: 'top',
  },
  {
    targetId: 'tutorial-table-actions',
    title: '10. Customize Your Table',
    content: "In table view, you can download the data as a CSV or enter 'Edit Mode' to remove columns, with undo/redo support. Your edits also apply to downloads and AI analysis.",
    placement: 'top',
  },
  {
    targetId: 'tutorial-view-switcher',
    title: '11. Analyze with AI',
    content: "Let AI do the heavy lifting! Click 'Analyze' to get an instant summary of your data and an auto-generated chart to visualize key trends.",
    placement: 'top',
  },
  {
    targetId: 'tutorial-context-banner',
    title: '12. Chain Queries with Context',
    content: "Click 'Use as Context' (the pin icon in result header) to use the current result set in your next query. This is great for multi-step questions.",
    placement: 'top',
  },
  {
    targetId: 'tutorial-notebook-button',
    title: '13. Export Your Workflow',
    content: "Click 'View Notebook' to open the session history panel. From there, you can export it as a Jupyter Notebook (.ipynb) to share or reproduce your analysis.",
    placement: 'bottom',
  },
   {
    targetId: 'tutorial-notebook-panel',
    title: '14. The Query Notebook',
    content: 'This panel logs every successful query. From here, you can clear your session history or export the entire workflow as a reproducible Jupyter Notebook file.',
    placement: 'left',
  },
  {
    targetId: 'tutorial-header-actions',
    title: '15. Manage Your Session',
    content: 'Here you can view saved queries, clear the cache to refresh resources, toggle dark mode, restart this tutorial, or sign out.',
    placement: 'bottom',
  },
  {
    targetId: 'modal',
    title: "You're all set!",
    content: "That's it! Explore and see what you can build. You can restart this tour anytime by clicking the help icon in the header.",
  },
];


interface TutorialProps {
    isActive: boolean;
    onClose: () => void;
    onStepChange: (index: number) => void;
}

const TutorialControlBar: React.FC<{
    currentStep: number;
    totalSteps: number;
    onNext: () => void;
    onPrev: () => void;
    onJump: (step: number) => void;
    onEnd: () => void;
}> = ({ currentStep, totalSteps, onNext, onPrev, onJump, onEnd }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const progress = ((currentStep + 1) / totalSteps) * 100;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[90vw] max-w-2xl bg-slate-800/80 backdrop-blur-lg text-white p-2 rounded-xl shadow-2xl border border-slate-700 z-[1002] flex items-center gap-2 sm:gap-4">
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 h-full bg-blue-600/30 rounded-xl transition-all duration-300" style={{ width: `${progress}%` }}></div>

            <div className="relative">
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="px-3 sm:px-4 py-2 rounded-lg hover:bg-slate-700/80 transition-colors z-10 relative flex items-center gap-2" title="Jump to a specific step">
                    Steps
                    <svg className={`w-4 h-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                {isMenuOpen && (
                    <div className="absolute bottom-full mb-2 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-80 overflow-auto">
                        {tutorialSteps.map((step, index) => (
                            <button
                                key={index}
                                onClick={() => { onJump(index); setIsMenuOpen(false); }}
                                className={`w-full text-left px-4 py-2 text-sm ${currentStep === index ? 'bg-blue-600 font-bold' : 'hover:bg-slate-700'}`}
                            >
                                {step.title}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            
            <div className="flex-grow flex items-center justify-center gap-2 sm:gap-4">
                <button onClick={onPrev} disabled={currentStep === 0} className="px-3 sm:px-4 py-2 rounded-lg hover:bg-slate-700/80 transition-colors disabled:opacity-50 z-10 relative" title="Go to the previous step">Back</button>
                <span className="font-mono text-sm z-10 relative">{currentStep + 1} / {totalSteps}</span>
                <button onClick={onNext} disabled={currentStep === totalSteps - 1} className="px-3 sm:px-4 py-2 rounded-lg hover:bg-slate-700/80 transition-colors disabled:opacity-50 z-10 relative" title="Go to the next step">Next</button>
            </div>

            <button onClick={onEnd} className="px-3 sm:px-4 py-2 rounded-lg bg-red-600/50 hover:bg-red-600 transition-colors z-10 relative" title="Exit the tutorial">End Tour</button>
        </div>
    );
};

const Tutorial: React.FC<TutorialProps> = ({ isActive, onClose, onStepChange }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const currentStep = useMemo(() => tutorialSteps[stepIndex], [stepIndex]);
  const isModalStep = currentStep?.targetId === 'modal';
  
  // Notify parent component of step changes
  useEffect(() => {
      if (isActive) {
          onStepChange(stepIndex);
      }
  }, [isActive, stepIndex, onStepChange]);

  const nextStep = () => {
    if (stepIndex < tutorialSteps.length - 1) {
        setStepIndex(stepIndex + 1);
    } else {
        endTour();
    }
  };
  const prevStep = () => setStepIndex(i => Math.max(i - 1, 0));
  const jumpToStep = (index: number) => setStepIndex(index);
  const endTour = () => {
    onClose();
    // After closing, reset to the first step for the next time it opens
    setTimeout(() => setStepIndex(0), 300);
  };

  useEffect(() => {
    if (!isActive) {
        setTargetRect(null); // Reset position
        return;
    };
    
    // Side panels have a 400ms slide-in animation. We need to wait for it
    // to finish before calculating its position for the highlight.
    const targetId = currentStep.targetId;
    const delay = (targetId === 'tutorial-notebook-panel' || targetId === 'tutorial-saved-queries-panel') ? 450 : 50;

    // For a smoother demo, we give the UI a moment to render the target element
    const timeoutId = setTimeout(() => {
      const targetElement = document.getElementById(currentStep?.targetId);
      if (targetElement) {
        setTargetRect(targetElement.getBoundingClientRect());
      } else {
        setTargetRect(null); // for modal steps
      }
    }, delay);

    const updatePosition = () => {
      const targetElement = document.getElementById(currentStep?.targetId);
      if (targetElement) {
        setTargetRect(targetElement.getBoundingClientRect());
      }
    };
    
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };

  }, [isActive, currentStep]);

  const popoverPosition = useMemo((): React.CSSProperties => {
    if (isModalStep) return {};
    if (!targetRect || !popoverRef.current) return { opacity: 0, pointerEvents: 'none' };
    
    const popoverHeight = popoverRef.current.offsetHeight;
    const popoverWidth = popoverRef.current.offsetWidth;
    const spacing = 16;
    
    let top, left;

    switch (currentStep.placement) {
        case 'top':
            top = targetRect.top - popoverHeight - spacing;
            left = targetRect.left + targetRect.width / 2 - popoverWidth / 2;
            break;
        case 'top-inside':
            top = targetRect.top + spacing;
            left = targetRect.left + targetRect.width / 2 - popoverWidth / 2;
            break;
        case 'right':
            top = targetRect.top + targetRect.height / 2 - popoverHeight / 2;
            left = targetRect.right + spacing;
            break;
        case 'left':
            top = targetRect.top + targetRect.height / 2 - popoverHeight / 2;
            left = targetRect.left - popoverWidth - spacing;
            break;
        case 'bottom':
        default:
            top = targetRect.bottom + spacing;
            left = targetRect.left + targetRect.width / 2 - popoverWidth / 2;
            break;
    }
    
    const margin = 10;
    top = Math.max(margin, Math.min(top, window.innerHeight - popoverHeight - margin));
    left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));

    return { top: `${top}px`, left: `${left}px` };
  }, [targetRect, currentStep, isModalStep]);

  if (!isActive) return null;
  
  const highlightStyle: React.CSSProperties = targetRect ? {
      position: 'fixed',
      top: `${targetRect.top - 5}px`,
      left: `${targetRect.left - 5}px`,
      width: `${targetRect.width + 10}px`,
      height: `${targetRect.height + 10}px`,
      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
      borderRadius: '8px',
      transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      pointerEvents: 'none',
      zIndex: 1000,
  } : {};
  
  const popoverContent = (
      <div className="flex flex-col h-full">
        {currentStep.targetId === 'modal' && stepIndex === 0 && (
            <div className="flex justify-center mb-4">
                <MongoIcon className="w-16 h-16 text-blue-500" />
            </div>
        )}
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">{currentStep.title}</h3>
        <p className="text-slate-600 dark:text-slate-300 flex-grow">{currentStep.content}</p>
      </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[100]">
        {!isModalStep && <div style={highlightStyle}></div>}
        
        <div
            ref={popoverRef}
            style={popoverPosition}
            className={`fixed bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl p-6 w-[360px] max-w-[90vw] z-[1001] transition-all duration-300 ease-in-out animate-fade-in
                ${isModalStep ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : ''}`}
        >
            <button
                onClick={endTour}
                className="absolute top-3 right-3 p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                aria-label="End tour"
                title="End tour"
            >
                <XIcon className="w-5 h-5"/>
            </button>
            {popoverContent}
        </div>
        
        <TutorialControlBar 
            currentStep={stepIndex}
            totalSteps={tutorialSteps.length}
            onNext={nextStep}
            onPrev={prevStep}
            onJump={jumpToStep}
            onEnd={endTour}
        />

        {isModalStep && <div className="fixed inset-0 bg-black/40 animate-fade-in-fast z-[1000]"></div>}
         
        <style>{`
          .animate-fade-in {
            animation: tutorial-fade-in 0.5s ease-out forwards;
          }
           .animate-fade-in-fast {
            animation: tutorial-backdrop-fade-in 0.3s ease-out forwards;
          }
          @keyframes tutorial-fade-in {
            from {
              opacity: 0;
              transform: translate(var(--tw-translate-x, 0), calc(var(--tw-translate-y, 0) + 10px)) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translate(var(--tw-translate-x, 0), var(--tw-translate-y, 0)) scale(1);
            }
          }
          @keyframes tutorial-backdrop-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
      `}</style>
    </div>
    , document.body
  );
};

export default Tutorial;
