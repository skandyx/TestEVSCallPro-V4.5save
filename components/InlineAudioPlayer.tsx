import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../src/store/useStore.ts';
import apiClient from '../src/lib/axios.ts';

interface InlineAudioPlayerProps {
    fileId: string;
    src: string;
    duration: number;
}

const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) {
        seconds = 0;
    }
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const InlineAudioPlayer: React.FC<InlineAudioPlayerProps> = ({ fileId, src, duration }) => {
    const { playingFileId, setPlayingFileId } = useStore();
    const audioRef = useRef<HTMLAudioElement>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    // Cleanup object URL on unmount
    useEffect(() => {
        const urlToClean = objectUrl;
        return () => {
            if (urlToClean) {
                URL.revokeObjectURL(urlToClean);
            }
        };
    }, [objectUrl]);

    // Sync with global state: if another file starts playing, stop this one.
    useEffect(() => {
        if (playingFileId !== fileId && isPlaying) {
            audioRef.current?.pause();
        }
    }, [playingFileId, fileId, isPlaying]);

    const handlePlayPause = async () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            // Set this as the active player globally
            setPlayingFileId(fileId);

            // If we already have the blob url, just play
            if (objectUrl) {
                if(audio.src !== objectUrl) audio.src = objectUrl;
                audio.play().catch(error => {
                    console.error("Audio playback error:", error);
                    setIsPlaying(false);
                    setPlayingFileId(null);
                });
                return;
            }

            // Fetch the audio file with authentication
            try {
                const response = await apiClient.get(src, { responseType: 'blob' });
                const blob = response.data; // CRITICAL FIX: response.data IS the blob

                if (blob.size === 0) {
                    console.error("Fetched audio blob is empty.");
                    setPlayingFileId(null); // Unset global state
                    return;
                }

                const url = URL.createObjectURL(blob);
                setObjectUrl(url);

                audio.src = url;
                audio.play().catch(error => {
                    console.error("Audio playback was prevented:", error);
                    setIsPlaying(false);
                    setPlayingFileId(null);
                    URL.revokeObjectURL(url); // Clean up on error
                    setObjectUrl(null);
                });

            } catch (error) {
                console.error(`[AudioPlayer] Failed to fetch audio source: ${src}`, error);
                setIsPlaying(false);
                setPlayingFileId(null);
            }
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
    };
    
    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (audioRef.current) {
            const newTime = Number(e.target.value);
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };
    
    const handleAudioEnded = () => {
        // State is handled by onPause, but we want to reset time
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            setCurrentTime(0);
        }
    };

    return (
        <div className="flex items-center gap-2 w-48">
            <audio 
                ref={audioRef} 
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleTimeUpdate} 
                onEnded={handleAudioEnded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => {
                    setIsPlaying(false);
                    if (playingFileId === fileId) {
                        setPlayingFileId(null);
                    }
                }}
                preload="metadata"
            />
            <button onClick={handlePlayPause} className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 p-1">
                <span className="material-symbols-outlined text-2xl">
                    {isPlaying ? 'pause' : 'play_arrow'}
                </span>
            </button>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-24 flex-shrink-0">
                {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-indigo-600"
                style={{'--thumb-color': 'rgb(79 70 229)'} as React.CSSProperties}
            />
        </div>
    );
};

export default InlineAudioPlayer;