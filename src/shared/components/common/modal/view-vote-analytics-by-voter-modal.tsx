import {
  Component,
  InfernoChild,
  InfernoFragment,
  InfernoNode,
  RefObject,
  createRef,
  linkEvent,
} from "inferno";
import { I18NextService } from "../../../services";
import type { Modal } from "bootstrap";
import { Spinner } from "../icon";
import {
  VoteAnalyticsGivenByPersonView,
  Person,
  VoteAnalyticsByPerson,
  VoteAnalyticsByCommunity,
} from "lemmy-js-client";
import {
  EMPTY_REQUEST,
  HttpService,
  LOADING_REQUEST,
  RequestState,
} from "../../../services/HttpService";
import { PersonListing } from "../../person/person-listing";
import { modalMixin } from "../../mixins/modal-mixin";
import { UserBadges } from "../user-badges";
import { isBrowser } from "@utils/browser";
import { CommunityLink } from "../../../components/community/community-link";
import { unixTimeToLocalDateStr } from "@utils/helpers";
import { getUnixTimeLemmy } from "@utils/helpers/get-unix-time";

interface ViewVoteAnalyticsByVoterModalProps {
  children?: InfernoNode;
  person: Person;
  show: boolean;
  onCancel: () => void;
}

interface ViewVoteAnalyticsByVoterModalState {
  voteAnalyticsByVoterRes: RequestState<VoteAnalyticsGivenByPersonView>;
  // Javascript treats this field as a string, that can't have timezone info.
  since?: string;
  until?: string;
  limit?: number;
}

@modalMixin
export default class ViewVoteAnalyticsByVoterModal extends Component<
  ViewVoteAnalyticsByVoterModalProps,
  ViewVoteAnalyticsByVoterModalState
> {
  readonly modalDivRef: RefObject<HTMLDivElement>;
  readonly yesButtonRef: RefObject<HTMLButtonElement>;
  modal?: Modal;
  state: ViewVoteAnalyticsByVoterModalState = {
    voteAnalyticsByVoterRes: EMPTY_REQUEST,
    limit: 10,
  };
  numberFormat: Intl.NumberFormat;

  constructor(props: ViewVoteAnalyticsByVoterModalProps, context: any) {
    super(props, context);

    this.modalDivRef = createRef();
    this.yesButtonRef = createRef();

    this.handleDismiss = this.handleDismiss.bind(this);
    this.handleSinceChange = this.handleSinceChange.bind(this);
    this.handleUntilChange = this.handleUntilChange.bind(this);
    this.handleLimitChange = this.handleLimitChange.bind(this);

    this.numberFormat = new Intl.NumberFormat();
  }

  async componentWillMount() {
    if (this.props.show && isBrowser()) {
      await this.refetch();
    }
  }

  async componentWillReceiveProps({
    show: nextShow,
  }: ViewVoteAnalyticsByVoterModalProps) {
    if (nextShow !== this.props.show) {
      if (nextShow) {
        await this.refetch();
      }
    }
  }

  render() {
    return (
      <div
        className="modal fade"
        id="viewVoteAnalyticsByVoterModal"
        tabIndex={-1}
        aria-hidden
        aria-labelledby="#viewVoteAnalyticsByVoterModalTitle"
        data-bs-backdrop="static"
        ref={this.modalDivRef}
      >
        <div className="modal-dialog modal-fullscreen">
          <div className="modal-content">
            <header className="modal-header">
              <h3
                className="modal-title"
                id="viewVoteAnalyticsByVoterModalTitle"
              >
                {I18NextService.i18n.t("votes")}
              </h3>
              <button
                type="button"
                className="btn-close"
                onClick={linkEvent(this, this.handleDismiss)}
                aria-label={I18NextService.i18n.t("cancel")}
              ></button>
            </header>
            <div className="modal-body text-center align-middle text-body">
              {this.getVoteAnalyticsByVoter()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  voteAnalyticsByVoterFilter() {
    return (
      <div>
        <label htmlFor="vote-analytics-by-voter-since">Since</label>
        <input
          type="datetime-local"
          id="vote-analytics-by-voter-since"
          max={unixTimeToLocalDateStr(Date.now())}
          value={this.state.since}
          onInput={linkEvent(this, this.handleSinceChange)}
        />
        <label htmlFor="vote-analytics-by-voter-until">Until</label>
        <input
          type="datetime-local"
          id="vote-analytics-by-voter-until"
          max={unixTimeToLocalDateStr(Date.now())}
          value={this.state.until}
          onInput={linkEvent(this, this.handleUntilChange)}
        />
        <label htmlFor="vote-analytics-by-voter-limit">Limit</label>
        <input
          type="number"
          id="vote-analytics-by-voter-limit"
          min="1"
          max="200"
          value={this.state.limit}
          onInput={linkEvent(this, this.handleLimitChange)}
        />
      </div>
    );
  }

  getTotalVotesRowHeader() {
    return (
      <tr>
        <th>Target</th>
        <th>Votes</th>
        <th>Upvotes</th>
        <th>Downvotes</th>
        <th>Upvote percentage</th>
      </tr>
    );
  }

  getVoteRowHeader() {
    return (
      <tr>
        <th>Target</th>
        <th>
          Votes
          <br />
          (% of total)
        </th>
        <th>
          Upvotes
          <br />
          (% of total)
        </th>
        <th>
          Downvotes
          <br />
          (% of total)
        </th>
        <th>Upvote percentage</th>
      </tr>
    );
  }

  getAllVotesRow(
    type: string,
    total: number,
    upvotes: number,
    downvotes: number,
    upvote_percentage: number,
  ) {
    return (
      <tr>
        <td>All {type} votes</td>
        <td>{this.numberFormat.format(total)}</td>
        <td>{this.numberFormat.format(upvotes)}</td>
        <td>{this.numberFormat.format(downvotes)}</td>
        <td>
          {this.numberFormat.format(Math.round(upvote_percentage * 100) / 100)}%
        </td>
      </tr>
    );
  }

  formatNumberWithPercentage(num: number, total: number): string {
    return `${this.numberFormat.format(num)} (${this.numberFormat.format(Math.round((10000 * num) / total) / 100)}%)`;
  }

  getVoteRow(
    target: InfernoChild | InfernoFragment | null | undefined,
    vote_analytics: VoteAnalyticsGivenByPersonView,
    target_analytics: VoteAnalyticsByCommunity | VoteAnalyticsByPerson,
    post_votes: boolean,
  ) {
    return (
      <tr>
        <td>{target}</td>
        <td>
          {this.formatNumberWithPercentage(
            target_analytics.total_votes,
            post_votes
              ? vote_analytics.post_votes_total_votes
              : vote_analytics.comment_votes_total_votes,
          )}
        </td>
        <td>
          {this.formatNumberWithPercentage(
            target_analytics.upvotes,
            post_votes
              ? vote_analytics.post_votes_total_upvotes
              : vote_analytics.comment_votes_total_upvotes,
          )}
        </td>
        <td>
          {this.formatNumberWithPercentage(
            target_analytics.downvotes,
            post_votes
              ? vote_analytics.post_votes_total_downvotes
              : vote_analytics.comment_votes_total_downvotes,
          )}
        </td>
        <td>
          {this.numberFormat.format(
            Math.round(target_analytics.upvote_percentage * 100) / 100,
          )}
          %
        </td>
      </tr>
    );
  }

  getPersonRow(
    vote_analytics: VoteAnalyticsGivenByPersonView,
    person: VoteAnalyticsByPerson,
    post_votes: boolean,
  ) {
    return this.getVoteRow(
      <>
        <PersonListing person={person.creator} useApubName />
        <UserBadges
          classNames="ms-1"
          isBot={person.creator.bot_account}
          isDeleted={person.creator.deleted}
          isBanned={person.creator.banned}
        />
      </>,
      vote_analytics,
      person,
      post_votes,
    );
  }

  getCommunityRow(
    vote_analytics: VoteAnalyticsGivenByPersonView,
    community: VoteAnalyticsByCommunity,
    post_votes: boolean,
  ) {
    return this.getVoteRow(
      <CommunityLink community={community.community} />,
      vote_analytics,
      community,
      post_votes,
    );
  }

  voteAnalyticsByVoterViewTable(
    vote_analytics: VoteAnalyticsGivenByPersonView,
  ) {
    return (
      <>
        {this.voteAnalyticsByVoterFilter()}
        <div className="table-responsive">
          <h5>Post votes</h5>
          <table id="community_table" className="table table-sm table-hover">
            <thead className="pointer">{this.getTotalVotesRowHeader()}</thead>
            <tbody>
              {this.getAllVotesRow(
                "post",
                vote_analytics.post_votes_total_votes,
                vote_analytics.post_votes_total_upvotes,
                vote_analytics.post_votes_total_downvotes,
                vote_analytics.post_votes_total_upvote_percentage,
              )}
              <tr>
                <th colSpan={5}>Post votes by receiving person</th>
              </tr>
              {this.getVoteRowHeader()}
              {vote_analytics.post_votes_by_target_user.map(v =>
                this.getPersonRow(vote_analytics, v, true),
              )}
              <tr>
                <th colSpan={5}>Post votes by receiving community</th>
              </tr>
              {this.getVoteRowHeader()}
              {vote_analytics.post_votes_by_target_community.map(v =>
                this.getCommunityRow(vote_analytics, v, true),
              )}
            </tbody>
          </table>
        </div>
        <div className="table-responsive">
          <h5>Comment votes</h5>
          <table id="community_table" className="table table-sm table-hover">
            <thead className="pointer">{this.getTotalVotesRowHeader()}</thead>
            <tbody>
              {this.getAllVotesRow(
                "comment",
                vote_analytics.comment_votes_total_votes,
                vote_analytics.comment_votes_total_upvotes,
                vote_analytics.comment_votes_total_downvotes,
                vote_analytics.comment_votes_total_upvote_percentage,
              )}
              <tr>
                <th colSpan={5}>Comment votes by receiving person</th>
              </tr>
              {this.getVoteRowHeader()}
              {vote_analytics.comment_votes_by_target_user.map(v =>
                this.getPersonRow(vote_analytics, v, false),
              )}
              <tr>
                <th colSpan={5}>Comment votes by receiving community</th>
              </tr>
              {this.getVoteRowHeader()}
              {vote_analytics.comment_votes_by_target_community.map(v =>
                this.getCommunityRow(vote_analytics, v, false),
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  getVoteAnalyticsByVoter() {
    switch (this.state.voteAnalyticsByVoterRes.state) {
      case "loading":
        return (
          <>
            {this.voteAnalyticsByVoterFilter()}
            <h1 className="h4">
              <Spinner large />
            </h1>
          </>
        );
      case "success": {
        return this.voteAnalyticsByVoterViewTable(
          this.state.voteAnalyticsByVoterRes.data,
        );
      }
    }
  }

  handleShow() {
    this.yesButtonRef.current?.focus();
  }

  async handleSinceChange(i: ViewVoteAnalyticsByVoterModal, event: any) {
    i.setState({ since: event.target.value });
    await this.refetch();
  }

  async handleUntilChange(i: ViewVoteAnalyticsByVoterModal, event: any) {
    i.setState({ until: event.target.value });
    await this.refetch();
  }

  async handleLimitChange(i: ViewVoteAnalyticsByVoterModal, event: any) {
    i.setState({ limit: event.target.value });
    await this.refetch();
  }

  handleDismiss() {
    this.props.onCancel();
    this.modal?.hide();
  }

  async refetch() {
    this.setState({ voteAnalyticsByVoterRes: LOADING_REQUEST });
    this.setState({
      voteAnalyticsByVoterRes: await HttpService.client.vote_analytics_by_voter(
        {
          person_id: this.props.person.id,
          start_time: getUnixTimeLemmy(this.state.since) ?? null,
          end_time: getUnixTimeLemmy(this.state.until) ?? null,
          limit: this.state.limit ?? null,
        },
      ),
    });
  }
}
