# Reduce poligonos de un modelo glTF con Blender en segundo plano, para que la oficina corra fluida.
# Uso: blender -b --python tools/decimate.py -- ruta/al/modelo.gltf 0.12
import sys
import bpy

args = sys.argv[sys.argv.index("--") + 1:]
src, ratio = args[0], float(args[1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
before = after = 0
for ob in list(bpy.context.scene.objects):
    if ob.type != "MESH":
        continue
    before += sum(len(p.vertices) - 2 for p in ob.data.polygons)
    bpy.context.view_layer.objects.active = ob
    mod = ob.modifiers.new("dec", "DECIMATE")
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    after += sum(len(p.vertices) - 2 for p in ob.data.polygons)
bpy.ops.export_scene.gltf(filepath=src, export_format="GLTF_SEPARATE", export_image_format="AUTO", use_selection=False)
print("DECIMADO", src, before, "->", after)
