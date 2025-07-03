import {
  ResponsiveContainer,
  AreaChart,
  CartesianGrid,
  Area,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppConfigStore } from './contexts/store';

type BaseChartProps = {
  data: { value: number | undefined }[];
  fill: string;
  stroke: string;
};

export function BaseChart(props: BaseChartProps) {
  const theme = useAppConfigStore((state) => state.theme);
  
  // 根据主题选择网格颜色
  const gridStroke = theme === 'light' ? '#e2e8f0' : '#333';
  const gridFill = theme === 'light' ? '#f8fafc' : '#1C1C1C';
  
  return (
    <ResponsiveContainer width={'100%'} height={'100%'}>
      <AreaChart data={props.data}>
        <CartesianGrid stroke={gridStroke} strokeDasharray="5 5" fill={gridFill} />
        <Area
          fillOpacity={0.3}
          fill={props.fill}
          stroke={props.stroke}
          strokeWidth={3}
          type="monotone"
          dataKey="value"
          isAnimationActive={false}
        />
        <XAxis stroke="transparent" height={0} />
        <YAxis domain={[0, 100]} stroke="transparent" width={0} />
      </AreaChart>
    </ResponsiveContainer>
  );
}