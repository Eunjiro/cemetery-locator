import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';

const cemeterySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  postal_code: z.string().max(20).optional(),
  description: z.string().optional(),
  total_area: z.number().positive().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  established_year: z.number().int().min(1000).max(9999).optional(),
  is_active: z.boolean().default(true),
  map_coordinates: z.array(z.array(z.number())).optional(),
});

// GET single cemetery
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cemetery = await queryOne(
      'SELECT * FROM cemeteries WHERE id = $1',
      [id]
    );

    if (!cemetery) {
      return NextResponse.json(
        { error: 'Cemetery not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ cemetery }, { status: 200 });
  } catch (error) {
    console.error('Error fetching cemetery:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cemetery' },
      { status: 500 }
    );
  }
}

// PUT update cemetery
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = cemeterySchema.parse(body);

    const result = await query(
      `UPDATE cemeteries SET
        name = $1, address = $2, city = $3, state = $4, country = $5,
        postal_code = $6, description = $7, total_area = $8,
        latitude = $9, longitude = $10, established_year = $11,
        is_active = $12, map_coordinates = $13, updated_at = CURRENT_TIMESTAMP
      WHERE id = $14
      RETURNING *`,
      [
        validatedData.name,
        validatedData.address || null,
        validatedData.city || null,
        validatedData.state || null,
        validatedData.country || null,
        validatedData.postal_code || null,
        validatedData.description || null,
        validatedData.total_area || null,
        validatedData.latitude || null,
        validatedData.longitude || null,
        validatedData.established_year || null,
        validatedData.is_active,
        validatedData.map_coordinates ? JSON.stringify(validatedData.map_coordinates) : null,
        id,
      ]
    );

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Cemetery not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { cemetery: result[0], message: 'Cemetery updated successfully' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error updating cemetery:', error);
    return NextResponse.json(
      { error: 'Failed to update cemetery' },
      { status: 500 }
    );
  }
}

// DELETE cemetery
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await query(
      'DELETE FROM cemeteries WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Cemetery not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Cemetery deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting cemetery:', error);
    return NextResponse.json(
      { error: 'Failed to delete cemetery' },
      { status: 500 }
    );
  }
}
