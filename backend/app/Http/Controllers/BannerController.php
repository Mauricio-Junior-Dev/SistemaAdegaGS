<?php

namespace App\Http\Controllers;

use App\Models\Banner;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

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
            'title' => 'nullable|string|max:255',
            'subtitle' => 'nullable|string|max:500',
            'image_url' => 'required|string',
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

        $banner = Banner::create($request->all());

        return response()->json($banner, 201);
    }

    /**
     * Atualizar um banner
     */
    public function update(Request $request, Banner $banner): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'title' => 'nullable|string|max:255',
            'subtitle' => 'nullable|string|max:500',
            'image_url' => 'required|string',
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

        $banner->update($request->all());

        return response()->json($banner);
    }

    /**
     * Excluir um banner
     */
    public function destroy(Banner $banner): JsonResponse
    {
        // Se a imagem está armazenada localmente, remover o arquivo
        if ($banner->image_url && str_starts_with($banner->image_url, 'storage/')) {
            $imagePath = str_replace('storage/', '', $banner->image_url);
            if (Storage::disk('public')->exists($imagePath)) {
                Storage::disk('public')->delete($imagePath);
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
            'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:2048'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Arquivo inválido',
                'errors' => $validator->errors()
            ], 422);
        }

        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $filename = time() . '_' . $image->getClientOriginalName();
            
            $path = $image->storeAs('banners', $filename, 'public');
            
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
