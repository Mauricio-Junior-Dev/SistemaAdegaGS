import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validador flexível de telefone brasileiro
 * Aceita números com ou sem formatação: (XX) XXXXX-XXXX ou XXXXXXXXXXX
 * Aceita telefones fixos (10 dígitos) ou celulares (11 dígitos)
 */
export function phoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null; // Deixa o required fazer essa validação
    }

    // Remove todos os caracteres não numéricos
    const cleanPhone = control.value.replace(/\D/g, '');

    // Verifica se tem 10 ou 11 dígitos (fixo ou celular)
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return { 
        invalidPhone: { 
          value: control.value, 
          message: 'Telefone deve ter 10 ou 11 dígitos' 
        } 
      };
    }

    // Verifica se começa com 0 (inválido)
    if (cleanPhone.startsWith('0')) {
      return { 
        invalidPhone: { 
          value: control.value, 
          message: 'Telefone não pode começar com 0' 
        } 
      };
    }

    // Verifica se o DDD é válido (11-99)
    const ddd = parseInt(cleanPhone.substring(0, 2));
    if (ddd < 11 || ddd > 99) {
      return { 
        invalidPhone: { 
          value: control.value, 
          message: 'DDD inválido' 
        } 
      };
    }

    return null; // Telefone válido
  };
}
