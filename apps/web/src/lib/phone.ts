// The API stores phone numbers in E.164 form (+12893797875). Show North
// American numbers the way people write them, and anything else as stored.
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(value);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : value;
}
