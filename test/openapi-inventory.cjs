const { ModulesContainer, MetadataScanner, Reflector } = require('@nestjs/core');
const { RequestMethod } = require('@nestjs/common');
const { PATH_METADATA, METHOD_METADATA, HTTP_CODE_METADATA, ROUTE_ARGS_METADATA } = require('@nestjs/common/constants');
const { IS_PUBLIC_KEY } = require('../dist/common/auth/public.decorator');
const { ROLES_KEY } = require('../dist/common/auth/roles.decorator');
const { getMetadataStorage } = require('class-validator');

// Discover only controllers instantiated in mounted modules. Swagger metadata
// is intentionally not used to discover paths, methods, security or DTO inputs.
function activeInventory(app) {
  const scanner = new MetadataScanner(); const reflector = new Reflector(); const result = [];
  for (const module of app.get(ModulesContainer).values()) for (const wrapper of module.controllers.values()) {
    const instance = wrapper.instance; if (!instance) continue;
    const controller = instance.constructor; const prototype = Object.getPrototypeOf(instance);
    for (const name of scanner.getAllMethodNames(prototype)) {
      const handler = prototype[name]; const methodNumber = Reflect.getMetadata(METHOD_METADATA, handler);
      if (methodNumber === undefined) continue;
      const prefixes = [].concat(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
      const suffixes = [].concat(Reflect.getMetadata(PATH_METADATA, handler) ?? '');
      const types = Reflect.getMetadata('design:paramtypes', prototype, name) ?? [];
      const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, name) ?? {};
      for (const prefix of prefixes) for (const suffix of suffixes) {
        const route = ['/api/v1', prefix, suffix].map(part => String(part).replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/');
        result.push({ method: RequestMethod[methodNumber].toLowerCase(), path: '/' + route.replace(/:([\w]+)/g, '{$1}'),
          controller: controller.name, handler: name, public: reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, controller]) === true,
          roles: reflector.getAllAndOverride(ROLES_KEY, [handler, controller]) ?? [],
          status: Reflect.getMetadata(HTTP_CODE_METADATA, handler) ?? (methodNumber === RequestMethod.POST ? 201 : 200),
          inputs: Object.entries(args).map(([key, arg]) => ({ kind: Number(key.split(':')[0]), name: arg.data, dto: types[arg.index]?.name,
            fields: types[arg.index] ? [...new Set(getMetadataStorage().getTargetValidationMetadatas(types[arg.index], '', false, false).map(meta => meta.propertyName))].sort() : [],
          })),
        });
      }
    }
  }
  return result.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
}
function expressInventory(app) {
  // Independent check against the actual Express router after app.listen().
  return app.getHttpAdapter().getInstance()._router.stack.filter(layer => layer.route?.path?.startsWith('/api/v1/'))
    .flatMap(layer => Object.keys(layer.route.methods).filter(method => layer.route.methods[method])
      .map(method => `${method} ${layer.route.path.replace(/:([\w]+)/g, '{$1}')}`)).sort();
}
module.exports = { activeInventory, expressInventory };
