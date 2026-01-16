import { useRef, useState, useCallback, useEffect } from 'react';

interface LassoPoint {
    x: number;
    y: number;
}

interface LassoOverlayProps {
    onComplete: (points: LassoPoint[]) => void;
    enabled: boolean;
}

export function LassoOverlay({ onComplete, enabled }: LassoOverlayProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [points, setPoints] = useState<LassoPoint[]>([]);

    // Resize canvas to match parent container
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const resizeCanvas = () => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    // Draw the lasso polygon
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (points.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        // Close the path if drawing is complete
        if (!isDrawing && points.length > 2) {
            ctx.closePath();
        }

        // Fill with semi-transparent color
        ctx.fillStyle = 'rgba(138, 43, 226, 0.15)';
        ctx.fill();

        // Draw dashed stroke
        ctx.strokeStyle = '#8a2be2';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
    }, [points, isDrawing]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (!enabled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setIsDrawing(true);
        setPoints([{ x, y }]);

        // Capture pointer to track movement even outside the element
        canvas.setPointerCapture(e.pointerId);
    }, [enabled]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDrawing || !enabled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Only add point if it's far enough from the last point (for performance)
        setPoints(prev => {
            const last = prev[prev.length - 1];
            if (last) {
                const dx = x - last.x;
                const dy = y - last.y;
                if (dx * dx + dy * dy < 25) return prev; // Skip if less than 5px
            }
            return [...prev, { x, y }];
        });
    }, [isDrawing, enabled]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDrawing) return;

        const canvas = canvasRef.current;
        if (canvas) {
            canvas.releasePointerCapture(e.pointerId);
        }

        setIsDrawing(false);

        // Only trigger selection if we have enough points
        if (points.length >= 3) {
            onComplete(points);
        }

        // Clear points after a short delay to show the final shape
        setTimeout(() => {
            setPoints([]);
        }, 150);
    }, [isDrawing, points, onComplete]);

    if (!enabled) return null;

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'auto',
                cursor: 'crosshair',
                zIndex: 10,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        />
    );
}

// Helper function to check if a point is inside a polygon using ray casting
export function isPointInPolygon(point: { x: number; y: number }, polygon: LassoPoint[]): boolean {
    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;

        if (((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }

    return inside;
}

export type { LassoPoint };
