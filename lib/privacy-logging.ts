// Log a stable operation label and a bounded machine code; database error
// messages/details can repeat submitted addresses, emails or other personal data.
export function logPrivateError(operation:string,error:unknown) {
  const candidate=error&&typeof error==='object'&&'code'in error?error.code:undefined;
  const code=typeof candidate==='string'&&/^[a-zA-Z0-9_]{1,32}$/.test(candidate)?candidate:'unknown';
  console.error(operation,{code});
}
