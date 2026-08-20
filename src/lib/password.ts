// Zeichen ohne leicht verwechselbare Zeichen (I/l/1, O/0), damit ein per
// WhatsApp weitergegebenes Passwort beim Abtippen nicht zu Fehlern führt.
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function generatePassword(length = 12): string {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => PASSWORD_CHARS[v % PASSWORD_CHARS.length]).join('');
}
