<?php

namespace App\Http\Controllers;

use App\Models\Banner;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class BannerController extends Controller
{
    /**
     * Listar todos os banners (para admin)
     */
    public function index(): JsonResponse
    {
        $banners = Banner::ordered()->get();
        return response()->json($banners);
    }

    /**
     * Listar apenas banners ativos (para frontend)
     */
    public function active(): JsonResponse
    {
        $banners = Banner::active()->ordered()->get();
        return response()->json($banners);
    }

    /**
     * Mostrar um banner específico
     */
    public function show(Banner $banner): JsonResponse
    {
        return response()->json($banner);
    }

    /**
     * Criar um novo banner
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'desktop_image' => 'required|string',
            'mobile_image' => 'nullable|string',
            'link' => 'nullable|string|max:500',
            'order' => 'required|integer|min:1',
            'is_active' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Dados inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $request->only(['desktop_image', 'mobile_image', 'link', 'order', 'is_active']);

        // Fallback: se não houver mobile_image, usa desktop_image
        if (empty($data['mobile_image']) && !empty($data['desktop_image'])) {
            $data['mobile_image'] = $data['desktop_image'];
        }

        $banner = Banner::create($data);

        return response()->json($banner, 201);
    }

    /**
     * Atualizar um banner
     */
    public function update(Request $request, Banner $banner): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'desktop_image' => 'sometimes|required|string',
            'mobile_image' => 'nullable|string',
            'link' => 'nullable|string|max:500',
            'order' => 'required|integer|min:1',
            'is_active' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Dados inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $request->only(['desktop_image', 'mobile_image', 'link', 'order', 'is_active']);

        // Fallback: se não houver mobile_image no payload, mas desktop_image foi enviada,
        // mantém coerência usando desktop_image
        if (array_key_exists('desktop_image', $data) && empty($data['mobile_image'])) {
            $data['mobile_image'] = $data['desktop_image'];
        }

        $banner->update($data);

        return response()->json($banner);
    }

    /**
     * Excluir um banner
     */
    public function destroy(Banner $banner): JsonResponse
    {
        // Se as imagens estão armazenadas localmente, remover os arquivos
        foreach (['desktop_image', 'mobile_image'] as $field) {
            $image = $banner->{$field};
            if ($image && str_starts_with($image, 'storage/')) {
                $imagePath = str_replace('storage/', '', $image);
                if (Storage::disk('public')->exists($imagePath)) {
                    Storage::disk('public')->delete($imagePath);
                }
            }
        }

        $banner->delete();

        return response()->json(['message' => 'Banner excluído com sucesso']);
    }

    /**
     * Upload de imagem para banner
     */
    public function upload(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpeg,png,jpg,gif,webp|max:5120' // Aumentado para 5MB e adicionado webp
        ], [
            'image.required' => 'Por favor, selecione uma imagem.',
            'image.image' => 'O arquivo deve ser uma imagem válida.',
            'image.max' => 'A imagem não pode ser maior que 5MB.',
            'image.mimes' => 'A imagem deve ser do tipo: jpg, jpeg, png, gif ou webp.',
            'image.uploaded' => 'Falha no upload da imagem. O arquivo pode ser muito grande.'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Arquivo inválido',
                'errors' => $validator->errors()
            ], 422);
        }

        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
            $extension = $file->getClientOriginalExtension();
            
            // Sanitiza: "Novos Planos.png" vira "novos-planos-1764184408.png"
            $safeName = Str::slug($originalName) . '-' . time() . '.' . $extension;
            
            // Salva com o nome seguro
            $path = $file->storeAs('banners', $safeName, 'public');
            
            $imageUrl = 'storage/' . $path;

            return response()->json([
                'image_url' => $imageUrl
            ]);
        }

        return response()->json([
            'message' => 'Erro no upload da imagem'
        ], 500);
    }

    /**
     * Reordenar banners
     */
    public function reorder(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'banner_ids' => 'required|array',
            'banner_ids.*' => 'integer|exists:banners,id'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Dados inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        $bannerIds = $request->input('banner_ids');

        foreach ($bannerIds as $index => $bannerId) {
            Banner::where('id', $bannerId)->update(['order' => $index + 1]);
        }

        $banners = Banner::ordered()->get();

        return response()->json($banners);
    }
}
