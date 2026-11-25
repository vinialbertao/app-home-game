/** Regras dos formulários de login e cadastro, e tradução dos erros do Supabase Auth. */
export const MIN_PASSWORD_LENGTH = 6;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(email));
}

export function checkDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Digite seu nome.';
  if (trimmed.length > 40) return 'Use até 40 caracteres.';
  return null;
}

export function checkPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}

type AuthErrorLike = { code?: string | null; message?: string | null; status?: number | null };

/** Mensagem em português para mostrar ao usuário, a partir do erro do Supabase. */
export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  if (!error) return 'Algo deu errado. Tente de novo.';
  const message = (error.message ?? '').toLowerCase();

  switch (error.code) {
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Já existe uma conta com esse e-mail. Use "Entrar".';
    case 'weak_password':
      return `Senha fraca. Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Esse e-mail não é válido.';
    case 'email_not_confirmed':
      return 'Esse e-mail ainda não foi confirmado.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
    case 'signup_disabled':
      return 'O cadastro está desligado no momento.';
    case 'unexpected_failure':
      return 'Não foi possível criar a conta. Confira a data de nascimento (18+).';
  }

  if (message.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (message.includes('already registered')) return 'Já existe uma conta com esse e-mail. Use "Entrar".';
  if (message.includes('database error saving new user')) {
    return 'Não foi possível criar a conta. Confira a data de nascimento (18+).';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Sem conexão com o servidor. Confira a internet.';
  }
  return 'Algo deu errado. Tente de novo.';
}
