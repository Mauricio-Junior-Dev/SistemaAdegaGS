<?php

namespace App\Rules;

use App\Models\Category;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Str;

/**
 * Garante unicidade de nome de categoria desconsiderando acentos, espaços e caixa.
 * Ex.: "Energético" e "Energetico" são tratados como o mesmo nome.
 */
class UniqueCategoryNameNormalized implements ValidationRule
{
    public function __construct(
        protected ?int $ignoreId = null
    ) {
    }

    /**
     * Executa a validação.
     *
     * @param  string  $attribute
     * @param  mixed   $value
     * @param  \Closure(string): void  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $inputName = (string) $value;
        $normalizedInput = $this->normalize($inputName);

        $query = Category::query();

        if ($this->ignoreId) {
            $query->where('id', '!=', $this->ignoreId);
        }

        $categories = $query->get(['id', 'name']);

        foreach ($categories as $category) {
            if ($this->normalize($category->name) === $normalizedInput) {
                $fail("A categoria \"{$category->name}\" já existe. Evite duplicatas.");
                return;
            }
        }
    }

    /**
     * Normaliza o texto removendo acentos, espaços extras e caixa.
     */
    private function normalize(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
          return '';
        }

        // Usar slug para remover acentos e normalizar espaços; depois remover hífens
        $slug = Str::slug($value, '-');
        return str_replace('-', '', $slug);
    }
}

