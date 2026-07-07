import { useEffect, useState } from 'react';
import { UsersRound } from 'lucide-react';
import { getInitials } from './conversationUi';

type Props = {
  avatarUrl?: string | null;
  name: string;
  isGroup?: boolean;
  alt?: string;
  iconSize?: number;
};

const CRMAvatarContent = ({
  avatarUrl,
  name,
  isGroup = false,
  alt,
  iconSize = 18,
}: Props) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const normalizedUrl = String(avatarUrl || '').trim() || null;

  useEffect(() => {
    if (failedUrl !== normalizedUrl) setFailedUrl(null);
  }, [failedUrl, normalizedUrl]);

  if (normalizedUrl && failedUrl !== normalizedUrl) {
    return (
      <img
        src={normalizedUrl}
        alt={alt ?? name}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setFailedUrl(normalizedUrl)}
      />
    );
  }

  if (isGroup) return <UsersRound size={iconSize} aria-hidden="true" />;
  return <>{getInitials(name)}</>;
};

export default CRMAvatarContent;
