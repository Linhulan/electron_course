import { useMemo } from "react";
import { BaseChart } from "./BaseChart";
import { useAppConfigStore } from "./contexts/store";

export type ChartProps = {
  data: number[];
  maxDataPoints: number;
};

export function Chart(props: ChartProps) {
  const theme = useAppConfigStore((state) => state.theme);
  
  const preparedData = useMemo(() => {
    const points = props.data.map((point) => ({ value: point * 100 }));
    return [
      ...points,
      ...Array.from({ length: props.maxDataPoints - points.length }, () => ({
        value: undefined,
      })),
    ];
  }, [props.data, props.maxDataPoints]);

  // 根据主题选择颜色
  const chartColor = theme === 'light' ? "#3b82f6" : "#00d8ff";

  return <BaseChart data={preparedData} fill={chartColor} stroke={chartColor} />;
}
