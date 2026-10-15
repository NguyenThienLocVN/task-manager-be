'use client';
import { useEffect, useState } from 'react';

interface Props { documentId: string; accessToken: string; apiOrigin: string; }

export default function DocumentPreview({ documentId, accessToken, apiOrigin }: Props) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setUrl(undefined);
    setError(undefined);
    (async () => {
      try {
        const res = await fetch(`${apiOrigin}/api/documents/${documentId}/file`, {
          headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (e) {
        if (!controller.signal.aborted) setError('Không thể mở tài liệu hoặc không có quyền truy cập.');
      }
    })();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [documentId, accessToken, apiOrigin]);

  if (error) return <p role="alert">{error}</p>;
  if (!url) return <p>Đang tải tài liệu...</p>;
  return <iframe title="Xem tài liệu" src={url} style={{ width: '100%', height: '80vh', border: 0 }} />;
}
