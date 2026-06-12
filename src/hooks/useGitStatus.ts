import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface GitStatus {
  branch_name: string;
  is_dirty: boolean;
}

export function useGitStatus(absolutePath: string | null | undefined, isDirty: boolean, saveStatus: string) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchGitStatus() {
      if (!absolutePath) {
        if (isMounted) setGitStatus(null);
        return;
      }

      try {
        const status = await invoke<GitStatus | null>('fetch_git_status', { filePath: absolutePath });
        if (isMounted) {
          setGitStatus(status);
        }
      } catch (err) {
        console.error('Failed to get git status:', err);
        if (isMounted) {
          setGitStatus(null);
        }
      }
    }

    // Debounce the git check slightly to avoid spamming the backend
    const timerId = setTimeout(fetchGitStatus, 250);

    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, [absolutePath, isDirty, saveStatus]); // re-run if file path changes, or if dirty/save state changes

  return gitStatus;
}
