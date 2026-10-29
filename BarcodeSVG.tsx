import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export interface BarcodeSVGProps {
  code: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  className?: string;
}

export const BarcodeSVG: React.FC<BarcodeSVGProps> = ({
  code,
  width = 1.5,
  height = 40,
  displayValue = true,
  fontSize = 12,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !code) return;

    try {
      JsBarcode(svgRef.current, code, {
        format: 'CODE128',
        width,
        height,
        displayValue,
        fontSize,
        font: 'monospace',
        textAlign: 'center',
        textPosition: 'bottom',
        textMargin: 2,
        margin: 4,
        background: 'transparent',
      });
    } catch (err) {
      console.warn('JsBarcode render error for code:', code, err);
    }
  }, [code, width, height, displayValue, fontSize]);

  if (!code) return null;

  return <svg ref={svgRef} className={`max-w-full ${className}`} />;
};
