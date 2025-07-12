
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import XIcon from './icons/XIcon';
import MongoIcon from './icons/MongoIcon';

// Define the structure of a tutorial step
interface TutorialStep {
  targetId: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'right' | 'left' | 'center';
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
    content: "Write a command in plain English, then click 'Generate Query'. You can also edit the generated code directly in the text area.",
    placement: 'top',
  },
  {
    targetId: 'tutorial-view-switcher',
    title: '4. View Your Results',
    content: "Your query results appear here. You can switch between a raw JSON view, an interactive Graph, and a powerful Table view.",
    placement: 'top',
  },
  {
    targetId: 'tutorial-table-actions',
    title: '5. Customize Your Table',
    content: "In table view, you can download the data as a CSV or enter 'Edit Mode' to remove columns, with undo/redo support. Your edits also apply to downloads and AI analysis.",
    placement: 'top',
  },
  {
    targetId: 'tutorial-view-switcher',
    title: '6. Analyze with AI',
    content: "Let AI do the heavy lifting! Click 'Analyze' to get an instant summary of your data and an auto-generated chart to visualize key trends.",
    placement: 'top',
  },
  {
    targetId: 'tutorial-view-switcher',
    title: '7. Chain Queries with Context',
    content: "Click 'Use as Context' (the pin icon) to use the current result set in your next query. This is great for multi-step questions.",
    placement: 'top',
  },
  {
    targetId: 'tutorial-results-area',
    title: '8. Debug with AI',
    content: "If a query fails, don't worry! Click 'Debug with AI' and the assistant will analyze the error and provide a fix.",
    placement: 'bottom',
  },
  {
    targetId: 'tutorial-header-actions',
    title: '9. Manage Your Session',
    content: 'Here you can clear the cache to refresh resources, toggle dark mode, restart this tutorial, or sign out.',
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

  const nextStep = () => setStepIndex(i => Math.min(i + 1, tutorialSteps.length - 1));
  const prevStep = () => setStepIndex(i => Math.max(i - 1, 0));
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
    
    // For a smoother demo, we give the UI a moment to render the target element
    const timeoutId = setTimeout(() => {
      const targetElement = document.getElementById(currentStep?.targetId);
      if (targetElement) {
        setTargetRect(targetElement.getBoundingClientRect());
      } else {
        setTargetRect(null); // for modal steps
      }
    }, 50); // Small delay

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
    // For modal steps, all positioning is handled by CSS classes.
    if (isModalStep) {
        return {};
    }
    
    // For non-modal steps, if we don't have the info yet,
    // hide the popover to prevent it from flashing in the wrong spot.
    if (!targetRect || !popoverRef.current) {
        return { opacity: 0, pointerEvents: 'none' };
    }
    
    const popoverHeight = popoverRef.current.offsetHeight;
    const popoverWidth = popoverRef.current.offsetWidth;
    const spacing = 16;
    
    let top, left;

    switch (currentStep.placement) {
        case 'top':
            top = targetRect.top - popoverHeight - spacing;
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
    
    // Boundary checks to prevent popover from going off-screen
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
        <div className="mt-6 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{stepIndex + 1} / {tutorialSteps.length}</span>
            <div className="flex items-center gap-2">
                {stepIndex > 0 && (
                    <button
                        onClick={prevStep}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                    >
                        Back
                    </button>
                )}
                <button
                    onClick={stepIndex === tutorialSteps.length - 1 ? endTour : nextStep}
                    className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                    {stepIndex === tutorialSteps.length - 1 ? 'Finish' : 'Next'}
                </button>
            </div>
        </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-50">
        {/* Highlight box creates the backdrop via its huge box-shadow */}
        {!isModalStep && <div style={highlightStyle}></div>}
        
        {/* Popover */}
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
            >
                <XIcon className="w-5 h-5"/>
            </button>
            {popoverContent}
        </div>
        
        {/* A subtle backdrop for modal steps */}
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
