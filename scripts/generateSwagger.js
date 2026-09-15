// Regenerates docs/swagger.json from `@swagger` JSDoc blocks on Route
// Handlers under src/app/api/**/route.js (plan Phase 11 — docs must
// "regenerate on build, not manual"). Run directly with `npm run swagger`,
// and automatically via the `prebuild` script before every `npm run build`.
//
// Uses next-swagger-doc's createSwaggerSpec, which is a thin App-Router-
// aware wrapper around swagger-jsdoc: it globs `apiFolder` for route files
// and parses any `@swagger` comment blocks it finds into an OpenAPI 3 spec.
// It needs no Next.js runtime/request context, so this runs as a plain node
// script — no dev server required.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSwaggerSpec } from 'next-swagger-doc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outFile = path.join(rootDir, 'docs', 'swagger.json');

const spec = createSwaggerSpec({
  apiFolder: 'src/app/api',
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Cremen Smart Spaces API',
      version: '1.0.0',
      description:
        'REST API for the Cremen Smart Spaces multi-tenant platform — Next.js App Router Route Handlers backed by Supabase. ' +
        'This spec is generated from `@swagger` JSDoc blocks on route handlers by scripts/generateSwagger.js; view it rendered at /api-docs. ' +
        'Only a representative subset of routes carries `@swagger` annotations so far (see the plan doc, Phase 11) — extend the pattern to the rest incrementally by adding the same style of block above any other exported GET/POST/PATCH/DELETE handler.'
    },
    servers: [{ url: '/', description: 'Same origin as this app' }],
    tags: [
      { name: 'Auth', description: 'Login and registration' },
      { name: 'Orders', description: 'Placing and tracking orders' },
      { name: 'Bills', description: 'Billing and payments' },
      { name: 'Menu', description: 'Menu items' },
      { name: 'Staff', description: 'Staff account management' },
      { name: 'Wallet', description: 'Organization coin wallet' },
      { name: 'Health', description: 'Service health checks' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'JWT issued by /api/auth/staff-login, /api/auth/customer-login, or /api/auth/register. Send as `Authorization: Bearer <token>`.'
        }
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            hiveId: { type: 'string', nullable: true },
            role: { type: 'string', enum: ['master_admin', 'owner', 'manager', 'cook', 'waiter', 'customer'] },
            authProvider: { type: 'string' },
            spaceId: { type: 'string', nullable: true },
            preferences: {
              type: 'object',
              properties: { orderCount: { type: 'integer' } }
            },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        MenuItemOptionChoice: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            priceDelta: { type: 'number' },
            isDefault: { type: 'boolean' }
          }
        },
        MenuItemOptionGroup: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            selectionType: { type: 'string' },
            isRequired: { type: 'boolean' },
            choices: { type: 'array', items: { $ref: '#/components/schemas/MenuItemOptionChoice' } }
          }
        },
        MenuItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            category: { type: 'string' },
            price: { type: 'number' },
            description: { type: 'string', nullable: true },
            imageUrl: { type: 'string', nullable: true },
            isAvailable: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            optionGroups: { type: 'array', items: { $ref: '#/components/schemas/MenuItemOptionGroup' } }
          }
        },
        OrderItem: {
          type: 'object',
          properties: {
            menuItem: { $ref: '#/components/schemas/MenuItem' },
            quantity: { type: 'integer' },
            priceAtPurchase: { type: 'number' },
            selectedOptions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  choiceId: { type: 'string' },
                  groupLabel: { type: 'string' },
                  choiceLabel: { type: 'string' },
                  priceDelta: { type: 'number' }
                }
              }
            }
          }
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            user: { $ref: '#/components/schemas/User' },
            items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
            totalAmount: { type: 'number' },
            status: { type: 'string', enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'] },
            orderTime: { type: 'string', format: 'date-time' },
            mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
            orderType: { type: 'string', enum: ['pickup', 'dine_in', 'delivery'] },
            tableNumber: { type: 'string', nullable: true },
            deliveryAddress: { type: 'string', nullable: true },
            deliveryLat: { type: 'number', nullable: true },
            deliveryLng: { type: 'number', nullable: true },
            deliveryPincode: { type: 'string', nullable: true },
            assignedCookId: { type: 'string', nullable: true },
            assignedRiderId: { type: 'string', nullable: true },
            deliveryStatus: { type: 'string', nullable: true },
            spaceId: { type: 'string', nullable: true }
          }
        },
        Bill: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            siteId: { type: 'string', nullable: true },
            spaceId: { type: 'string', nullable: true },
            customerId: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['pending', 'paid', 'company_charged'] },
            paymentMethod: { type: 'string', nullable: true, enum: ['cash', 'online', null] },
            totalAmount: { type: 'number' },
            couponCodeId: { type: 'string', nullable: true },
            razorpayOrderId: { type: 'string', nullable: true },
            cashCollectedBy: { type: 'string', nullable: true },
            cashCollectedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            paidAt: { type: 'string', format: 'date-time', nullable: true },
            orderIds: { type: 'array', items: { type: 'string' } }
          }
        },
        WalletTransaction: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string' },
            amount: { type: 'integer' },
            balanceAfter: { type: 'integer' },
            referenceType: { type: 'string', nullable: true },
            referenceId: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Wallet: {
          type: 'object',
          nullable: true,
          properties: {
            balanceCoins: { type: 'integer' },
            lowBalanceThreshold: { type: 'integer' },
            recentTransactions: { type: 'array', items: { $ref: '#/components/schemas/WalletTransaction' } }
          }
        }
      }
    },
    // Per-route `security: []` (see e.g. the login routes) opts out where a
    // route is intentionally public; every other annotated route inherits
    // this bearer requirement.
    security: [{ bearerAuth: [] }]
  }
});

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(spec, null, 2)}\n`, 'utf-8');

const pathCount = Object.keys(spec.paths ?? {}).length;
const operationCount = Object.values(spec.paths ?? {}).reduce((sum, methods) => sum + Object.keys(methods).length, 0);
console.log(`[swagger] wrote ${path.relative(rootDir, outFile)} — ${pathCount} path(s), ${operationCount} operation(s) documented.`);

if (pathCount === 0) {
  console.warn('[swagger] warning: no @swagger blocks were found under src/app/api — is apiFolder correct?');
}
