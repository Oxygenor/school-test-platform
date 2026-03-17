'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export function StudentSessionGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkExistingSession() {
      const sessionId = localStorage.getItem('studentSessionId');
      if (!sessionId) return;

      const response = await fetch(`/api/get-session?sessionId=${sessionId}`);
      const data = await response.json();

      if (
        data.ok &&
        data.session &&
        ['writing', 'blocked'].includes(data.session.status)
      ) {
        const target = `/student/exam?sessionId=${data.session.id}`;
        if (pathname !== '/student/exam') {
          router.replace(target);
        }
      } else {
        localStorage.removeItem('studentSessionId');
        localStorage.removeItem('studentId');
        localStorage.removeItem('studentFullName');
        localStorage.removeItem('studentClassId');
      }
    }

    checkExistingSession();
  }, [router, pathname]);

  return null;
}