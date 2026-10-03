import { db } from '@/lib/db'
import type { Prisma } from '@/generated/prisma/client'

/**
 * FR-082 / BRULE-35: catatan audit bersifat hanya-tambah.
 * Tidak ada fungsi update atau delete di modul ini — secara sengaja.
 *
 * Kegagalan pencatatan audit tidak boleh menggagalkan aksi utama: artikel yang
 * sudah tersimpan tidak pantas dibatalkan hanya karena log gagal ditulis.
 */
export async function recordAudit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId?: string,
  metadata?: Prisma.InputJsonValue,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: { actorId, action, entity, entityId: entityId ?? null, metadata: metadata ?? undefined },
    })
  } catch (error) {
    console.error('[audit] gagal mencatat', { action, entity, entityId, error })
  }
}
