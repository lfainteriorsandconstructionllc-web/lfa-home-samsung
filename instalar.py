#!/usr/bin/env python3
"""Prepara Home; firma e instala solo con opciones explícitas y herramientas oficiales."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import re
import stat
import subprocess
import tempfile
import zipfile

BASE = Path(__file__).resolve().parent
FILES = ('config.xml', 'index.html', 'style.css', 'home-model.js', 'home-theme.js', 'home-media.js', 'home-weather.js', 'home-preferences.js', 'home-player.js', 'app.js', 'apps.js', 'lfa-home-icon.png', 'config.js')
# Inventario explícito: nunca copiar carpetas completas ni archivos privados adicionales.
# 1.11.0: módulos de Volley reutilizados sin modificarlos. Única fuente de
# verdad: app/ en la raíz del proyecto; se copian al paquete como vendor/.
# No existen en launcher/ ni deben editarse allí.
VENDOR = {
    'vendor/volley-model.js': ('app', 'model.js'),
    'vendor/turkey.js': ('app', 'providers', 'turkey.js'),
    'vendor/russia.js': ('app', 'providers', 'russia.js'),
}
VENDOR_MARKERS = {'vendor/volley-model.js': 'root.VolleyModel', 'vendor/turkey.js': 'VolleyProviders.turkey', 'vendor/russia.js': 'VolleyProviders.russia'}


def vendor_sources():
    """Rutas de origen de vendor/, comprobadas antes de modificar nada."""
    sources = {}
    for name, parts in VENDOR.items():
        current = BASE
        for part in parts[:-1]:
            current = current / part
            check_path(current, directory=True)
        path = current / parts[-1]
        check_path(path)
        if path.stat().st_size > 512 * 1024:
            raise ValueError('Módulo de Volley demasiado grande: ' + str(path))
        if VENDOR_MARKERS[name] not in path.read_text(encoding='utf-8'):
            raise ValueError('Módulo de Volley no reconocido: ' + str(path))
        sources[name] = path
    return sources


def run(args, cwd=None):
    subprocess.run(args, cwd=cwd, check=True)


def check_path(path, directory=False, missing_ok=False):
    """lstat detecta también enlaces colgantes; rechaza junctions de Windows."""
    try:
        info = path.lstat()
    except FileNotFoundError:
        if missing_ok:
            return False
        raise
    reparse = getattr(info, 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0)
    if stat.S_ISLNK(info.st_mode) or reparse:
        raise ValueError('No se permiten enlaces simbólicos: ' + str(path))
    valid = stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)
    if not valid:
        raise ValueError('Se esperaba un ' + ('directorio: ' if directory else 'archivo regular: ') + str(path))
    return True


def check_destinations():
    build = BASE / 'build'
    check_path(build, directory=True, missing_ok=True)
    stage = build / 'package'
    if check_path(stage, directory=True, missing_ok=True):
        # No borrar un árbol previo con enlaces o archivos especiales.
        for root, dirs, files in os.walk(stage):
            for name in dirs:
                check_path(Path(root) / name, directory=True)
            for name in files:
                check_path(Path(root) / name)
    check_path(build / 'Home-unsigned.wgt', missing_ok=True)


def device_icons(launcher):
    """Sólo iconos declarados y verificados; nunca copiar un árbol de datos personales."""
    directory = launcher / 'device-icons'
    if not check_path(directory, directory=True, missing_ok=True):
        return []
    manifest = directory / 'manifest.json'
    check_path(manifest)
    if manifest.stat().st_size > 65536:
        raise ValueError('Inventario de iconos demasiado grande')
    inventory = json.loads(manifest.read_text(encoding='utf-8'))
    if not isinstance(inventory, dict) or len(inventory) > 500:
        raise ValueError('Inventario de iconos inválido')
    allowed = set(inventory) | {'manifest.json'}
    for path in directory.iterdir():
        if path.name not in allowed:
            raise ValueError('Archivo no permitido en iconos: ' + str(path))
        check_path(path)
    packaged = []
    for name, digest in sorted(inventory.items()):
        if not isinstance(name, str) or not re.fullmatch(r'[a-z0-9_-]{1,64}\.(?:png|svg)', name):
            raise ValueError('Nombre de icono inválido')
        if not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest):
            raise ValueError('Hash de icono inválido')
        path = directory / name
        check_path(path)
        if path.stat().st_size > 2 * 1024 * 1024:
            raise ValueError('Icono demasiado grande: ' + name)
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != digest:
            raise ValueError('El icono no coincide con su inventario: ' + name)
        if name.endswith('.png') and not data.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError('El archivo no es PNG: ' + name)
        if name.endswith('.svg'):
            text = data.decode('utf-8').lower()
            if '<svg' not in text or re.search(r'<script|<!doctype|<!entity|\bon\w+\s*=|(?:href|url)\s*[=(]', text):
                raise ValueError('SVG de icono no permitido: ' + name)
        packaged.append('device-icons/' + name)
    return packaged


def prepare():
    launcher = BASE / 'launcher'
    check_path(BASE, directory=True)
    check_path(launcher, directory=True)
    check_destinations()
    defaults = []
    # Completar todas las comprobaciones antes de crear configuraciones o borrar un build.
    for name in FILES:
        src = launcher / name
        if not check_path(src, missing_ok=name in ('apps.js', 'config.js')):
            example = launcher / (src.stem + '.example.js')
            check_path(example)
            defaults.append((src, example))
    packaged = list(FILES)
    packaged.extend(device_icons(launcher))
    vendor = vendor_sources()
    packaged.extend(sorted(vendor))
    for dest, example in defaults:
        # Creación exclusiva: no seguir un enlace introducido en un destino ausente.
        with dest.open('xb') as target, example.open('rb') as source:
            shutil.copyfileobj(source, target)
        if dest.name == 'config.js':
            print('Creado config.js sin ubicación ni claves. Personalízalo si quieres.')
    build = BASE / 'build'
    build.mkdir(exist_ok=True)
    stage = build / 'package'
    output = build / 'Home-unsigned.wgt'
    # Preparar en un directorio privado; publicar solo cuando todo esté copiado.
    with tempfile.TemporaryDirectory(prefix='.home-', dir=build) as temporary:
        temporary = Path(temporary)
        pending = temporary / 'package'
        pending.mkdir()
        for name in packaged:
            dest = pending / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(vendor.get(name, launcher / name), dest)
        archive = temporary / 'Home-unsigned.wgt'
        with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED) as z:
            for name in sorted(packaged):
                # Metadatos neutros; sin rutas absolutas ni usuario del ordenador.
                info = zipfile.ZipInfo(name, (2020, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                z.writestr(info, (pending / name).read_bytes())
        check_destinations()
        if stage.exists():
            shutil.rmtree(stage)
        pending.replace(stage)
        archive.replace(output)
    print('Paquete SIN FIRMA creado: build/Home-unsigned.wgt. No se puede instalar todavía.')
    return stage


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', help='Nombre de tu perfil Samsung TV del Certificate Manager')
    parser.add_argument('--target', help='Serial exacto de sdb devices (solo para tu TV)')
    parser.add_argument('--install', action='store_true', help='Instalar el paquete firmado')
    parser.add_argument('--desinstalar', action='store_true', help='Desinstalar Home del target indicado')
    args = parser.parse_args()
    if args.desinstalar:
        if not args.target:
            parser.error('--desinstalar requiere --target')
        run(['tizen', 'uninstall', '-p', 'HkTvHome01.Home', '-s', args.target])
        return
    if args.install and (not args.profile or not args.target):
        parser.error('--install requiere --profile y --target')
    if args.profile and not shutil.which('tizen'):
        parser.error('Falta tizen en PATH: instala Tizen Studio y las extensiones de Samsung TV')
    stage = prepare()
    if not args.profile:
        return
    run(['tizen', 'package', '-t', 'wgt', '-s', args.profile, '--', str(stage)])
    signed = list(stage.glob('*.wgt'))
    if len(signed) != 1:
        raise RuntimeError('Se esperaba exactamente un paquete firmado en build/package')
    with zipfile.ZipFile(signed[0]) as z:
        if not {'author-signature.xml', 'signature1.xml'} <= set(z.namelist()):
            raise RuntimeError('Faltan firmas en el paquete generado; no se instalará')
    print('Paquete firmado generado. La TV validará la cadena y permisos del certificado.')
    if args.install:
        run(['tizen', 'install', '-n', signed[0].name, '-s', args.target, '--', str(stage)])
        print('Abre Home desde Apps. Volver no cierra Home; usa el botón Home del mando.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        raise SystemExit('Error: ' + str(error))
