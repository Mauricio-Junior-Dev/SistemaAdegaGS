import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Validador robusto de CPF (Cadastro de Pessoa Física)
 * Valida formato e dígitos verificadores
 */
export function cpfValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) {
    return null; // Deixa o required fazer essa validação
  }

  const cpf = control.value.replace(/\D/g, '');

  // Verifica se tem 11 dígitos
  if (cpf.length !== 11) {
    return { invalidCpf: { value: control.value, message: 'CPF deve ter 11 dígitos' } };
  }

  // Verifica se todos os dígitos são iguais (CPF inválido)
  if (/^(\d)\1{10}$/.test(cpf)) {
    return { invalidCpf: { value: control.value, message: 'CPF inválido' } };
  }

  // Valida dígitos verificadores
  let sum = 0;
  let remainder: number;

  // Valida primeiro dígito verificador
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.substring(9, 10))) {
    return { invalidCpf: { value: control.value, message: 'CPF inválido' } };
  }

  // Valida segundo dígito verificador
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.substring(10, 11))) {
    return { invalidCpf: { value: control.value, message: 'CPF inválido' } };
  }

  return null; // CPF válido
}

/**
 * Validador robusto de CNPJ (Cadastro Nacional de Pessoa Jurídica)
 * Valida formato e dígitos verificadores
 */
export function cnpjValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) {
    return null; // Deixa o required fazer essa validação
  }

  const cnpj = control.value.replace(/\D/g, '');

  // Verifica se tem 14 dígitos
  if (cnpj.length !== 14) {
    return { invalidCnpj: { value: control.value, message: 'CNPJ deve ter 14 dígitos' } };
  }

  // Verifica se todos os dígitos são iguais (CNPJ inválido)
  if (/^(\d)\1{13}$/.test(cnpj)) {
    return { invalidCnpj: { value: control.value, message: 'CNPJ inválido' } };
  }

  // Valida dígitos verificadores
  let length = cnpj.length - 2;
  let numbers = cnpj.substring(0, length);
  const digits = cnpj.substring(length);
  let sum = 0;
  let pos = length - 7;

  // Valida primeiro dígito verificador
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) {
    return { invalidCnpj: { value: control.value, message: 'CNPJ inválido' } };
  }

  // Valida segundo dígito verificador
  length = length + 1;
  numbers = cnpj.substring(0, length);
  sum = 0;
  pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) {
    return { invalidCnpj: { value: control.value, message: 'CNPJ inválido' } };
  }

  return null; // CNPJ válido
}

/**
 * Validador de CPF ou CNPJ
 * Aceita ambos os formatos e valida de acordo com o tamanho
 */
export function documentValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) {
    return null; // Deixa o required fazer essa validação
  }

  const document = control.value.replace(/\D/g, '');

  // CPF: 11 dígitos
  if (document.length === 11) {
    return cpfValidator(control);
  }

  // CNPJ: 14 dígitos
  if (document.length === 14) {
    return cnpjValidator(control);
  }

  // Tamanho inválido
  return { 
    invalidDocument: { 
      value: control.value, 
      message: 'Documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ)' 
    } 
  };
}

/**
 * Formata CPF: 000.000.000-00
 */
export function formatCpf(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 11) {
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return numbers.substring(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/**
 * Formata CNPJ: 00.000.000/0000-00
 */
export function formatCnpj(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 14) {
    return numbers
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
  return numbers.substring(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

/**
 * Formata CPF ou CNPJ automaticamente de acordo com o tamanho
 */
export function formatDocument(value: string): string {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 11) {
    return formatCpf(value);
  } else {
    return formatCnpj(value);
  }
}
