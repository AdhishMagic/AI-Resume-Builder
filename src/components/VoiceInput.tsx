import { useState, useEffect, useRef } from 'react';

interface VoiceInputProps {
    onTranscript: (text: string) => void;
    isListening?: boolean;
    onToggle?: (isListening: boolean) => void;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscript, onToggle }) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        // Initialize Speech Recognition
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                if (finalTranscript) {
                    onTranscript(finalTranscript);
                }
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                stopListening();
            };

            recognitionRef.current.onend = () => {
                // If it stops but we think we are listening, restart (unless explicitly stopped)
                // For simple UX, let's auto-stop if silence
                if (isListening) {
                    // Optional: setIsListening(false);
                }
            };
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const startListening = () => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.start();
                setIsListening(true);
                onToggle?.(true);
            } catch (e) {
                console.error("Failed to start speech recognition", e);
            }
        } else {
            alert("Voice input is not supported in this browser. Please use Chrome or Edge.");
        }
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
            onToggle?.(false);
        }
    };

    const toggleListening = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        return null; // Hide if not supported
    }

    return (
        <button
            onClick={toggleListening}
            className={`
                relative p-2 rounded-full transition-all duration-300
                ${isListening
                    ? 'bg-red-500/20 text-red-500 animate-pulse ring-2 ring-red-500/40'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}
            `}
            title={isListening ? "Stop Recording" : "Start Voice Input"}
        >
            {isListening ? (
                // Stop/Square Icon
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
            ) : (
                // Mic Icon
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
            )}

            {/* Ripple Effect when listening */}
            {isListening && (
                <span className="absolute -inset-1 rounded-full border border-red-500/50 animate-ping opacity-75"></span>
            )}
        </button>
    );
};
