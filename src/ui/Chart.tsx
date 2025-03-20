import { useMemo } from "react";
import { BaseChart } from "./BaseChart";

export type ChartProps = {
  data: number[];
  maxDataPoints: number;
};

export function Chart(props: ChartProps) {
  const preparedData = useMemo(() => {
    const points = props.data.map((point) => ({ value: point * 1000 }));
    return [
      ...points,
      ...Array.from({ length: props.maxDataPoints - points.length }, () => ({
        value: undefined,
      })),
    ];
  }, [props.data, props.maxDataPoints]);

  return <BaseChart data={preparedData} fill={"#00d8ff"} stroke={"#00d8ff"} />;
}
