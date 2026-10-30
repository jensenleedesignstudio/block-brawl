import { ringPositions, type Match } from "../../shared/combat";

/** Responsive presentation of the same world positions used by the old canvas radar. */
export function RingMap ({ match, viewIndex }: { match: Match; viewIndex: 0 | 1 }) {
    const points = ringPositions(match).map((point) => ({
        x: 53 + point.x * 0.14,
        y: 47 + point.y * 0.14
    }));
    return (
        <svg
            className="ring-map"
            viewBox="0 0 106 90"
            role="img"
            aria-label="Ring position: your fighter in gold, opponent in blue"
        >
            <title>Ring position</title>
            <rect x="1" y="1" width="104" height="88" rx="4" fill="#14271ff0" stroke="#b59b6266" />
            <text
                x="53"
                y="10"
                fill="#d2d9c2"
                textAnchor="middle"
                fontSize="7"
                fontFamily="monospace"
            >
                RING POSITION
            </text>
            <rect x="10" y="13" width="86" height="65" fill="#101e1a" stroke="#809887" />
            <line
                x1={points[0].x}
                y1={points[0].y}
                x2={points[1].x}
                y2={points[1].y}
                stroke="#789989"
                strokeWidth="2"
            />
            {points.map((point, index) => (
                <rect
                    key={index}
                    x={point.x - 4}
                    y={point.y - 4}
                    width="8"
                    height="8"
                    fill={index === viewIndex ? "#ffcf45" : "#49beff"}
                />
            ))}
        </svg>
    );
}
