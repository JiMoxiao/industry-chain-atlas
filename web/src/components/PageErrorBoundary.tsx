import { Component, type ReactNode } from "react";
import { StatePanel } from "@/components/StatePanel";

interface PageErrorBoundaryProps {
  children: ReactNode;
}

interface PageErrorBoundaryState {
  hasError: boolean;
}

export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {}

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <StatePanel
          title="页面加载失败"
          description="当前页面在渲染过程中出现异常。可以先重试一次；如果仍然失败，再切回其他页面继续浏览。"
          actionLabel="重试当前页面"
          onAction={this.handleRetry}
          className="min-h-[320px]"
          tone="warn"
        />
      );
    }

    return this.props.children;
  }
}
