type AvatarProfile = {
  username: string;
  display_name: string;
  avatar_url: string | null;
};

const HUES = [338, 18, 42, 158, 196, 262, 288, 120];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function Avatar({
  profile,
  size = 40,
  className = "",
}: {
  profile: AvatarProfile;
  size?: number;
  className?: string;
}) {
  const name = profile.display_name || profile.username;
  const style = { width: size, height: size };

  if (profile.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatar_url}
        alt={name}
        width={size}
        height={size}
        style={style}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  const hue = HUES[hash(profile.username) % HUES.length];
  return (
    <span
      role="img"
      aria-label={name}
      style={{
        ...style,
        fontSize: Math.round(size * 0.42),
        background: `hsl(${hue} 55% 32%)`,
        color: `hsl(${hue} 90% 88%)`,
      }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold leading-none ${className}`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
