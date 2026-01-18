import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';

const plotSchema = z.object({
  cemetery_id: z.number().int().positive(),
  section_id: z.number().int().positive().optional(),
  plot_number: z.string().min(1).max(50),
  plot_type: z.string().max(50).optional(),
  status: z.enum(['available', 'occupied', 'reserved', 'unavailable']).default('available'),
  size_length: z.number().positive().optional(),
  size_width: z.number().positive().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  map_coordinates: z.union([
    z.object({
      x: z.number(),
      y: z.number(),
    }),
    z.array(z.tuple([z.number(), z.number()])),
  ]).optional(),
  price: z.number().positive().optional(),
  notes: z.string().optional(),
  layers: z.number().int().positive().default(1),
});

// GET all plots for a cemetery
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cemeteryId = searchParams.get('cemetery_id');

  if (!cemeteryId) {
    return NextResponse.json(
      { error: 'cemetery_id is required' },
      { status: 400 }
    );
  }

  try {
    const plotsData = await query(
      `SELECT * FROM grave_plots 
       WHERE cemetery_id = $1 
       ORDER BY plot_number ASC`,
      [cemeteryId]
    );

    // Parse JSON fields
    const plots = plotsData.map((plot: any) => ({
      ...plot,
      map_coordinates: plot.map_coordinates ? 
        (typeof plot.map_coordinates === 'string' ? JSON.parse(plot.map_coordinates) : plot.map_coordinates) 
        : null,
    }));

    return NextResponse.json({ plots }, { status: 200 });
  } catch (error) {
    console.error('Error fetching plots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plots' },
      { status: 500 }
    );
  }
}

// POST create new plot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = plotSchema.parse(body);

    const result = await query(
      `INSERT INTO grave_plots (
        cemetery_id, section_id, plot_number, plot_type, status,
        size_length, size_width, latitude, longitude, map_coordinates, price, notes, layers
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        validatedData.cemetery_id,
        validatedData.section_id,
        validatedData.plot_number,
        validatedData.plot_type,
        validatedData.status,
        validatedData.size_length,
        validatedData.size_width,
        validatedData.latitude,
        validatedData.longitude,
        validatedData.map_coordinates ? JSON.stringify(validatedData.map_coordinates) : null,
        validatedData.price,
        validatedData.notes,
        validatedData.layers,
      ]
    );

    return NextResponse.json(
      { plot: result[0], message: 'Plot created successfully' },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error creating plot:', error);
    return NextResponse.json(
      { error: 'Failed to create plot' },
      { status: 500 }
    );
  }
}
