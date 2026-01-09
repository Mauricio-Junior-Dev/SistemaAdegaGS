<?php

namespace App\Rules;

use Illuminate\Contracts\Validation\Rule;

/**
 * Validação robusta de CPF/CNPJ
 * Valida formato e dígitos verificadores para garantir integridade dos dados
 * especialmente importante para transações PIX
 */
class DocumentNumber implements Rule
{
    private $type;

    /**
     * Create a new rule instance.
     *
     * @param string|null $type 'cpf', 'cnpj' ou null para aceitar ambos
     */
    public function __construct($type = null)
    {
        $this->type = $type;
    }

    /**
     * Determine if the validation rule passes.
     *
     * @param  string  $attribute
     * @param  mixed  $value
     * @return bool
     */
    public function passes($attribute, $value)
    {
        if (empty($value)) {
            return false;
        }

        // Remove caracteres não numéricos
        $document = preg_replace('/\D/', '', $value);

        // Verifica o tipo de documento
        if ($this->type === 'cpf' || (!$this->type && strlen($document) === 11)) {
            return $this->validateCpf($document);
        }

        if ($this->type === 'cnpj' || (!$this->type && strlen($document) === 14)) {
            return $this->validateCnpj($document);
        }

        return false;
    }

    /**
     * Valida CPF
     *
     * @param string $cpf
     * @return bool
     */
    private function validateCpf($cpf)
    {
        // Verifica se tem 11 dígitos
        if (strlen($cpf) !== 11) {
            return false;
        }

        // Verifica se todos os dígitos são iguais (CPF inválido)
        if (preg_match('/(\d)\1{10}/', $cpf)) {
            return false;
        }

        // Valida primeiro dígito verificador
        $sum = 0;
        for ($i = 0; $i < 9; $i++) {
            $sum += intval($cpf[$i]) * (10 - $i);
        }
        $remainder = ($sum * 10) % 11;
        if ($remainder === 10 || $remainder === 11) {
            $remainder = 0;
        }
        if ($remainder !== intval($cpf[9])) {
            return false;
        }

        // Valida segundo dígito verificador
        $sum = 0;
        for ($i = 0; $i < 10; $i++) {
            $sum += intval($cpf[$i]) * (11 - $i);
        }
        $remainder = ($sum * 10) % 11;
        if ($remainder === 10 || $remainder === 11) {
            $remainder = 0;
        }
        if ($remainder !== intval($cpf[10])) {
            return false;
        }

        return true;
    }

    /**
     * Valida CNPJ
     *
     * @param string $cnpj
     * @return bool
     */
    private function validateCnpj($cnpj)
    {
        // Verifica se tem 14 dígitos
        if (strlen($cnpj) !== 14) {
            return false;
        }

        // Verifica se todos os dígitos são iguais (CNPJ inválido)
        if (preg_match('/(\d)\1{13}/', $cnpj)) {
            return false;
        }

        // Valida primeiro dígito verificador
        $length = 12;
        $numbers = substr($cnpj, 0, $length);
        $digits = substr($cnpj, $length);
        $sum = 0;
        $pos = $length - 7;

        for ($i = $length; $i >= 1; $i--) {
            $sum += intval($numbers[$length - $i]) * $pos--;
            if ($pos < 2) {
                $pos = 9;
            }
        }

        $result = $sum % 11 < 2 ? 0 : 11 - ($sum % 11);
        if ($result !== intval($digits[0])) {
            return false;
        }

        // Valida segundo dígito verificador
        $length = 13;
        $numbers = substr($cnpj, 0, $length);
        $sum = 0;
        $pos = $length - 7;

        for ($i = $length; $i >= 1; $i--) {
            $sum += intval($numbers[$length - $i]) * $pos--;
            if ($pos < 2) {
                $pos = 9;
            }
        }

        $result = $sum % 11 < 2 ? 0 : 11 - ($sum % 11);
        if ($result !== intval($digits[1])) {
            return false;
        }

        return true;
    }

    /**
     * Get the validation error message.
     *
     * @return string
     */
    public function message()
    {
        if ($this->type === 'cpf') {
            return 'O CPF informado não é válido. Verifique os dígitos e tente novamente.';
        }

        if ($this->type === 'cnpj') {
            return 'O CNPJ informado não é válido. Verifique os dígitos e tente novamente.';
        }

        return 'O CPF/CNPJ informado não é válido. Por favor, verifique os dígitos e tente novamente.';
    }
}
